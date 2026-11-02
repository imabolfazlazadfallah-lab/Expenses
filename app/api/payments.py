from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime
from typing import Any
from urllib.parse import urlparse
from urllib.error import HTTPError, URLError
from urllib.request import Request as URLRequest, urlopen

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import RedirectResponse

from app.api.auth import require_active_user
from app.database import get_connection

router = APIRouter(prefix="/api/payments", tags=["Payments"])
logger = logging.getLogger(__name__)

ZIBAL_REQUEST_URL = "https://gateway.zibal.ir/v1/request"
ZIBAL_VERIFY_URL = "https://gateway.zibal.ir/v1/verify"
ZIBAL_START_URL = "https://gateway.zibal.ir/start/{track_id}"
DEFAULT_MONTHLY_PRICE_TOMAN = 50000
SUBSCRIPTION_DAYS = 30


def _monthly_price_toman() -> int:
    try:
        value = int(os.getenv("MONTHLY_LICENSE_PRICE_TOMAN", str(DEFAULT_MONTHLY_PRICE_TOMAN)))
    except (TypeError, ValueError):
        value = DEFAULT_MONTHLY_PRICE_TOMAN
    if value <= 0:
        return DEFAULT_MONTHLY_PRICE_TOMAN
    return value


def _serialize_datetime(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat(sep=" ", timespec="seconds")
    return str(value)


def _post_json(url: str, payload: dict[str, Any], timeout: int = 20) -> dict[str, Any]:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = URLRequest(
        url,
        data=body,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            response_body = response.read().decode("utf-8", errors="replace")
    except HTTPError as exc:
        safe_body = exc.read().decode("utf-8", errors="replace")[:500]
        logger.warning("Zibal HTTP error: status=%s response=%s", exc.code, safe_body)
        raise RuntimeError("در ارتباط با درگاه پرداخت خطای HTTP رخ داد.") from exc
    except (URLError, TimeoutError, OSError) as exc:
        logger.warning("Zibal connection error: %s", type(exc).__name__)
        raise RuntimeError("ارتباط با درگاه زیبال برقرار نشد.") from exc

    try:
        parsed = json.loads(response_body)
    except json.JSONDecodeError as exc:
        logger.warning("Zibal returned invalid JSON.")
        raise RuntimeError("پاسخ درگاه پرداخت قابل‌خواندن نبود.") from exc
    if not isinstance(parsed, dict):
        raise RuntimeError("ساختار پاسخ درگاه پرداخت معتبر نیست.")
    return parsed


def _redirect_result(result: str) -> RedirectResponse:
    # Never trust a callback-supplied return URL; always return to this app.
    return RedirectResponse(url=f"/?payment={result}", status_code=status.HTTP_303_SEE_OTHER)


def _mark_order_failed(order_id: str | None, message: str) -> None:
    if not order_id:
        return
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            """UPDATE EXP_PAYMENT_ORDERS
                  SET STATUS = 'FAILED', GATEWAY_MESSAGE = :message
                WHERE ORDER_ID = :order_id AND STATUS = 'PENDING'""",
            {"message": str(message or "پرداخت انجام نشد")[:1000], "order_id": order_id},
        )
        connection.commit()
    except Exception:
        connection.rollback()
        logger.exception("Could not mark Zibal order as failed.")
    finally:
        connection.close()


@router.get("/status")
def subscription_status(request: Request):
    """Return server-authoritative subscription state and display price."""
    user = require_active_user(request)
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            """SELECT ACTIVE_UNTIL,
                      CASE WHEN ACTIVE_UNTIL > SYSTIMESTAMP THEN 1 ELSE 0 END AS IS_ACTIVE
                 FROM EXP_USER_SUBSCRIPTIONS
                WHERE USER_ID = :user_id""",
            {"user_id": user["user_id"]},
        )
        row = cursor.fetchone()
        active_until = row[0] if row else None
        active = bool(row and int(row[1] or 0) == 1)
        return {
            "status": "success",
            "priceToman": _monthly_price_toman(),
            "subscription": {
                "active": active,
                "activeUntil": _serialize_datetime(active_until),
            },
        }
    except Exception as exc:
        logger.exception("Could not load the user's subscription status.")
        raise HTTPException(status_code=500, detail="وضعیت اشتراک از پایگاه داده خوانده نشد.") from exc
    finally:
        connection.close()


@router.post("/zibal/request")
def create_zibal_payment(request: Request):
    """Create a server-priced payment order and ask Zibal for a checkout trackId."""
    user = require_active_user(request)
    merchant = os.getenv("ZIBAL_MERCHANT", "").strip()
    callback_url = os.getenv("ZIBAL_CALLBACK_URL", "").strip()
    if not merchant or merchant.lower() in {"zibal", "merchant_id_here", "your_merchant_id"}:
        raise HTTPException(status_code=503, detail="شناسه پذیرنده واقعی زیبال باید در محیط اجرای سرور تنظیم شود.")
    callback = urlparse(callback_url)
    if (
        callback.scheme.lower() != "https"
        or not callback.hostname
        or callback.path.rstrip("/") != "/api/payments/zibal/callback"
    ):
        raise HTTPException(
            status_code=503,
            detail="آدرس بازگشت HTTPS باید به مسیر /api/payments/zibal/callback روی دامنه واقعی برنامه اشاره کند.",
        )

    user_id = int(user["user_id"])
    price_toman = _monthly_price_toman()
    amount_rial = price_toman * 10  # Zibal expects the amount in Rials.
    order_id = "SUB-" + uuid.uuid4().hex.upper()

    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            """INSERT INTO EXP_PAYMENT_ORDERS
                   (ORDER_ID, USER_ID, AMOUNT_TOMAN, AMOUNT_RIAL,
                    SUBSCRIPTION_DAYS, STATUS, CREATED_AT)
               VALUES (:order_id, :user_id, :amount_toman, :amount_rial,
                       :subscription_days, 'PENDING', SYSTIMESTAMP)""",
            {
                "order_id": order_id,
                "user_id": user_id,
                "amount_toman": price_toman,
                "amount_rial": amount_rial,
                "subscription_days": SUBSCRIPTION_DAYS,
            },
        )
        connection.commit()
    except Exception as exc:
        connection.rollback()
        logger.exception("Could not create a pending subscription order.")
        raise HTTPException(status_code=500, detail="سفارش پرداخت در پایگاه داده ثبت نشد.") from exc
    finally:
        connection.close()

    try:
        result = _post_json(
            ZIBAL_REQUEST_URL,
            {
                "merchant": merchant,
                "amount": amount_rial,
                "callbackUrl": callback_url,
                "description": "اشتراک ماهانه مدیریت هزینه - ۳۰ روز",
                "orderId": order_id,
            },
        )
        try:
            result_code = int(result.get("result", -1))
        except (TypeError, ValueError):
            result_code = -1
        track_id_value = result.get("trackId")
        if result_code != 100 or track_id_value in (None, "", 0, "0"):
            message = str(result.get("message") or f"کد پاسخ زیبال: {result_code}")
            _mark_order_failed(order_id, message)
            logger.warning("Zibal rejected payment request, result=%s", result_code)
            raise HTTPException(status_code=502, detail="درگاه زیبال درخواست پرداخت را نپذیرفت. تنظیمات پذیرنده را بررسی کنید.")

        track_id = str(track_id_value)
        connection = get_connection()
        try:
            cursor = connection.cursor()
            cursor.execute(
                """UPDATE EXP_PAYMENT_ORDERS
                      SET TRACK_ID = :track_id, GATEWAY_MESSAGE = :message
                    WHERE ORDER_ID = :order_id AND STATUS = 'PENDING'""",
                {"track_id": track_id, "message": str(result.get("message") or "درخواست پرداخت ایجاد شد")[:1000], "order_id": order_id},
            )
            connection.commit()
        except Exception as exc:
            connection.rollback()
            logger.exception("Could not store the Zibal trackId.")
            raise HTTPException(status_code=500, detail="شناسه پیگیری پرداخت ذخیره نشد؛ با پشتیبانی تماس بگیرید.") from exc
        finally:
            connection.close()

        return {
            "status": "success",
            "orderId": order_id,
            "trackId": track_id,
            "checkoutUrl": ZIBAL_START_URL.format(track_id=track_id),
            "amountToman": price_toman,
        }
    except HTTPException:
        raise
    except RuntimeError as exc:
        _mark_order_failed(order_id, str(exc))
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/zibal/callback", include_in_schema=False)
def zibal_callback(request: Request):
    """Verify the gateway transaction server-to-server; activate only once after verification."""
    query = request.query_params
    success_value = str(query.get("success", "0")).strip()
    track_id = str(query.get("trackId") or query.get("trackid") or "").strip()
    order_id = str(query.get("orderId") or query.get("orderid") or "").strip() or None

    if not track_id:
        # Without the gateway trackId, callback query parameters are not trusted
        # to mutate an order. Leave any pending order available for reconciliation.
        return _redirect_result("failed")
    if success_value != "1":
        # Only mark it failed if the supplied trackId matches the pending order.
        connection = get_connection()
        try:
            cursor = connection.cursor()
            if order_id:
                cursor.execute(
                    "UPDATE EXP_PAYMENT_ORDERS SET STATUS = 'FAILED', GATEWAY_MESSAGE = :message "
                    "WHERE ORDER_ID = :order_id AND TRACK_ID = :track_id AND STATUS = 'PENDING'",
                    {"message": "پرداخت توسط کاربر لغو شد یا درگاه آن را ناموفق اعلام کرد",
                     "order_id": order_id, "track_id": track_id},
                )
                connection.commit()
        except Exception:
            connection.rollback()
            logger.exception("Could not record the canceled Zibal order.")
        finally:
            connection.close()
        return _redirect_result("failed")

    merchant = os.getenv("ZIBAL_MERCHANT", "").strip()
    if not merchant:
        logger.error("ZIBAL_MERCHANT is missing during payment callback.")
        return _redirect_result("pending")

    # Read the pending order and ensure this trackId belongs to the exact order.
    connection = get_connection()
    try:
        cursor = connection.cursor()
        if order_id:
            cursor.execute(
                """SELECT ORDER_ID, USER_ID, AMOUNT_RIAL, STATUS, TRACK_ID, SUBSCRIPTION_DAYS
                     FROM EXP_PAYMENT_ORDERS WHERE ORDER_ID = :order_id""",
                {"order_id": order_id},
            )
        else:
            cursor.execute(
                """SELECT ORDER_ID, USER_ID, AMOUNT_RIAL, STATUS, TRACK_ID, SUBSCRIPTION_DAYS
                     FROM EXP_PAYMENT_ORDERS WHERE TRACK_ID = :track_id""",
                {"track_id": track_id},
            )
        row = cursor.fetchone()
        if not row:
            return _redirect_result("failed")
        order_id_db, user_id, amount_rial, order_status, saved_track_id, subscription_days = row
        order_id_db = str(order_id_db)
        if str(saved_track_id or "") != track_id:
            return _redirect_result("failed")
        if str(order_status).upper() == "PAID":
            return _redirect_result("success")
        if str(order_status).upper() != "PENDING":
            return _redirect_result("failed")
    except Exception:
        logger.exception("Could not load the payment order during Zibal callback.")
        return _redirect_result("pending")
    finally:
        connection.close()

    try:
        track_id_for_api: int | str = int(track_id) if track_id.isdigit() else track_id
        verified = _post_json(ZIBAL_VERIFY_URL, {"merchant": merchant, "trackId": track_id_for_api})
        try:
            verify_code = int(verified.get("result", -1))
        except (TypeError, ValueError):
            verify_code = -1
    except RuntimeError:
        logger.exception("Zibal verification call failed; leave the order pending for reconciliation.")
        return _redirect_result("pending")

    # In Zibal's response, 100 means verified; 201 means the transaction was already verified.
    if verify_code not in (100, 201):
        _mark_order_failed(order_id_db, str(verified.get("message") or f"کد تأیید زیبال: {verify_code}"))
        return _redirect_result("failed")

    # If the verify response provides amount/orderId, also compare them to our persisted order.
    returned_amount = verified.get("amount")
    if returned_amount not in (None, ""):
        try:
            if int(returned_amount) != int(amount_rial):
                _mark_order_failed(order_id_db, "مبلغ پاسخ تأیید زیبال با مبلغ سفارش یکسان نیست")
                logger.error("Zibal amount mismatch for order %s", order_id_db)
                return _redirect_result("failed")
        except (TypeError, ValueError):
            _mark_order_failed(order_id_db, "مبلغ پاسخ تأیید زیبال معتبر نیست")
            return _redirect_result("failed")
    returned_order_id = verified.get("orderId")
    if returned_order_id not in (None, "") and str(returned_order_id) != order_id_db:
        _mark_order_failed(order_id_db, "شماره سفارش پاسخ تأیید زیبال تطابق ندارد")
        logger.error("Zibal orderId mismatch for order %s", order_id_db)
        return _redirect_result("failed")

    reference_number = verified.get("refNumber") or verified.get("referenceNumber") or verified.get("rrn")
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            """SELECT STATUS, TRACK_ID, USER_ID, SUBSCRIPTION_DAYS
                 FROM EXP_PAYMENT_ORDERS WHERE ORDER_ID = :order_id FOR UPDATE""",
            {"order_id": order_id_db},
        )
        locked = cursor.fetchone()
        if not locked:
            connection.rollback()
            return _redirect_result("pending")
        locked_status, locked_track_id, locked_user_id, locked_days = locked
        if str(locked_status).upper() == "PAID":
            connection.commit()
            return _redirect_result("success")
        if str(locked_status).upper() != "PENDING" or str(locked_track_id or "") != track_id:
            connection.rollback()
            return _redirect_result("failed")

        cursor.execute(
            """MERGE INTO EXP_USER_SUBSCRIPTIONS target
               USING (SELECT :user_id AS USER_ID FROM DUAL) source
                  ON (target.USER_ID = source.USER_ID)
               WHEN MATCHED THEN UPDATE SET
                    target.ACTIVE_UNTIL = CASE
                        WHEN target.ACTIVE_UNTIL > SYSTIMESTAMP
                        THEN target.ACTIVE_UNTIL + NUMTODSINTERVAL(:days, 'DAY')
                        ELSE SYSTIMESTAMP + NUMTODSINTERVAL(:days, 'DAY')
                    END,
                    target.UPDATED_AT = SYSTIMESTAMP
               WHEN NOT MATCHED THEN INSERT (USER_ID, ACTIVE_UNTIL, UPDATED_AT)
                    VALUES (source.USER_ID, SYSTIMESTAMP + NUMTODSINTERVAL(:days, 'DAY'), SYSTIMESTAMP)""",
            {"user_id": int(locked_user_id), "days": int(locked_days or SUBSCRIPTION_DAYS)},
        )
        cursor.execute(
            """UPDATE EXP_PAYMENT_ORDERS
                  SET STATUS = 'PAID', REF_NUMBER = :reference_number,
                      VERIFIED_AT = SYSTIMESTAMP, GATEWAY_MESSAGE = :message
                WHERE ORDER_ID = :order_id AND STATUS = 'PENDING'""",
            {
                "reference_number": str(reference_number)[:100] if reference_number not in (None, "") else None,
                "message": str(verified.get("message") or "پرداخت با موفقیت تأیید شد")[:1000],
                "order_id": order_id_db,
            },
        )
        connection.commit()
        return _redirect_result("success")
    except Exception:
        connection.rollback()
        logger.exception("Payment was verified but the Oracle activation transaction failed.")
        return _redirect_result("pending")
    finally:
        connection.close()
