import datetime
import os
import re
from typing import Dict, Optional, List
from datetime import timezone
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, Request, Response, status, Query, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import logging
import requests
from app.auth import *
from app.database import *
from app.database import fs
from app.database import fs, warehouse_master_collection
from app.models import AuditForm, UserLogin, UserRegister
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
import io
from docx import Document
from docx.shared import Pt
import base64, re
from docx.shared import Inches
import smtplib
from email.message import EmailMessage
import tempfile
from fastapi import UploadFile, Form
from fastapi import FastAPI, Depends, Form, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse, RedirectResponse
from datetime import datetime
import io
import os
import smtplib
from email.message import EmailMessage
import base64
import re
import logging
from openpyxl import Workbook
from openpyxl.drawing.image import Image
from openpyxl.utils import get_column_letter
from openpyxl.styles import Alignment
import smtplib
from email.message import EmailMessage
from fastapi import UploadFile, Form, File, Depends
from typing import Optional
from datetime import datetime, timezone
from fastapi.responses import JSONResponse
import os, io, base64, re
from docx import Document
from docx.shared import Pt, Inches
import bcrypt
import pandas as pd
from bson import ObjectId
from pydantic import BaseModel

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

SERPAPI_KEY = os.getenv("SERPAPI_KEY")

app = FastAPI()

# Get the absolute path to the static folder
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, "static")

# Mount static files for serving HTML/CSS/JS
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Base response format
base_response = {
    "message": "",
    "success": False,
    "data": None,
    "status_code": status.HTTP_400_BAD_REQUEST
}

def validate_password(password: str) -> bool:
    if len(password) < 8:
        return False
    if not re.search(r"[A-Z]", password):
        return False
    if not re.search(r"[a-z]", password):
        return False
    if not re.search(r"\d", password):
        return False
    if not re.search(r"[!@#$%^&*()]", password):
        return False
    return True


# ─────────────────────────────────────────────────────────────────────────────
#  AUTH ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/register")
async def register(user: UserRegister):
    logger.info(f"Register attempt for email: {user.email}")
    try:
        if not validate_password(user.password):
            return JSONResponse(
                content={"message": "Invalid password format", "success": False},
                status_code=status.HTTP_400_BAD_REQUEST
            )
        if user.password != user.confirm_password:
            return JSONResponse(
                content={"message": "Passwords do not match", "success": False},
                status_code=status.HTTP_400_BAD_REQUEST
            )
        existing_user = users.find_one({"email": user.email})
        if existing_user:
            return JSONResponse(
                content={"message": "Email already registered", "success": False},
                status_code=status.HTTP_400_BAD_REQUEST
            )
        hashed_password = bcrypt.hashpw(
            user.password.encode("utf-8"), bcrypt.gensalt()
        ).decode("utf-8")
        users.insert_one({
            "name": user.name,
            "email": user.email,
            "password_hash": hashed_password,
            "created_at": datetime.now(timezone.utc),
        })
        return JSONResponse(
            content={"message": "User registered successfully", "success": True, "data": {"email": user.email}},
            status_code=status.HTTP_201_CREATED
        )
    except Exception as e:
        logger.error(f"Error in register: {str(e)}")
        return JSONResponse(
            content={"message": f"Server error: {str(e)}", "success": False},
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@app.post("/api/login")
def login(user: UserLogin):
    logger.info(f"Login attempt for email: {user.email}")
    db_user = users.find_one({"email": user.email})
    if not db_user:
        return JSONResponse({"message": "Invalid email or password", "success": False}, status_code=401)
    password = user.password
    password_hash = db_user.get("password_hash")
    if not isinstance(password, str) or not isinstance(password_hash, str):
        return JSONResponse({"message": "Invalid email or password", "success": False}, status_code=401)
    if not bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8")):
        return JSONResponse({"message": "Invalid email or password", "success": False}, status_code=401)
    token = create_jwt({"sub": user.email})
    return JSONResponse(
        {"message": "Logged in successfully", "success": True, "data": {"access_token": token}},
        status_code=200
    )


@app.get("/api/me")
async def get_me(emp_id: str = Depends(get_current_user)):
    try:
        user = users.find_one({"email": emp_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        response = base_response.copy()
        response.update({
            "message": "User info retrieved successfully",
            "success": True,
            "data": {"email": user["email"], "name": user.get("name", "Unknown")},
            "status_code": status.HTTP_200_OK
        })
        return JSONResponse(content=response, status_code=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Error in get_me: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/logout")
async def logout(emp_id: str = Depends(get_current_user)):
    return JSONResponse(
        content={"message": "Logged out successfully", "success": True, "data": None},
        status_code=200
    )


# ─────────────────────────────────────────────────────────────────────────────
#  AUDIT SECTIONS
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/get-sections")
async def get_sections(emp_id: str = Depends(get_current_user)):
    try:
        today = datetime.now(timezone.utc).date().isoformat()
        audit = temp_audit_data_collection.find_one({"user_id": emp_id, "date": today})
        section_keys = [
            "general_report", "stock_reconciliation",
            "observations_on_stacking", "observations_on_warehouse_operations",
            "observations_on_warehouse_record_keeping", "observations_on_wh_infrastructure",
            "observations_on_quality_operation", "checklist_wrt_exchange_circular_mentha_oil",
            "checklist_wrt_exchange_circular_metal", "checklist_wrt_exchange_circular_cotton_bales",
            "signature", "photo"
        ]
        completion_status = {
            k: (audit["completion_status"].get(k, False) if audit and "completion_status" in audit else False)
            for k in section_keys
        }
        response = base_response.copy()
        response.update({
            "message": "Sections retrieved successfully",
            "success": True,
            "data": {"completion_status": completion_status},
            "status_code": status.HTTP_200_OK
        })
        return JSONResponse(content=response, status_code=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Error in get_sections: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/get-section/{section_name}")
async def get_section(section_name: str, emp_id: str = Depends(get_current_user)):
    try:
        today = datetime.now(timezone.utc).date().isoformat()
        audit = temp_audit_data_collection.find_one({"user_id": emp_id, "date": today})
        section_data = audit["sections"].get(section_name, {}) if audit and "sections" in audit else {}
        response = base_response.copy()
        response.update({
            "message": f"Section {section_name} retrieved successfully",
            "success": True,
            "data": {"section_data": section_data},
            "status_code": status.HTTP_200_OK
        })
        return JSONResponse(content=response, status_code=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Error in get_section: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/save-section")
async def save_section(request: Request, emp_id: str = Depends(get_current_user)):
    try:
        body = await request.json()
        section = body.get("section")
        data = body.get("data")
        date = body.get("date")
        if not section or not data or not date:
            return JSONResponse(
                content={"message": "Missing required fields (section, data, date)", "success": False},
                status_code=400
            )

        # --- GridFS: extract photo and store separately ---
        if section == "photo" and "photo" in data and data["photo"].startswith("data:image"):
            try:
                header, b64data = data["photo"].split(",", 1)
                img_bytes = base64.b64decode(b64data)
                file_id = fs.put(
                    img_bytes,
                    filename=f"{emp_id}_{date}_photo.png",
                    content_type="image/png",
                    metadata={"user_id": emp_id, "date": date}
                )
                data["photo"] = None          # don't store base64 in document
                data["photo_file_id"] = str(file_id)  # store GridFS reference
            except Exception as img_err:
                logger.warning(f"GridFS photo store failed, falling back to base64: {img_err}")

        audit = temp_audit_data_collection.find_one({"user_id": emp_id, "date": date})
        if not audit:
            audit = {
                "user_id": emp_id, "date": date, "sections": {},
                "completion_status": {}, "submitted_by": emp_id,
                "submitted_at": datetime.now(timezone.utc)
            }
        audit["sections"][section] = data
        audit["completion_status"][section] = True
        if audit.get("_id"):
            temp_audit_data_collection.update_one(
                {"_id": audit["_id"]},
                {"$set": {"sections": audit["sections"], "completion_status": audit["completion_status"]}}
            )
        else:
            temp_audit_data_collection.insert_one(audit)
        response = base_response.copy()
        response.update({
            "message": f"Section {section} saved successfully",
            "success": True,
            "data": {"completion_status": audit["completion_status"]},
            "status_code": 200
        })
        return JSONResponse(content=response, status_code=200)
    except Exception as e:
        logger.error(f"Error in save_section: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/get-photo/{file_id}")
async def get_photo(file_id: str, emp_id: str = Depends(get_current_user)):
    """Serve a photo stored in GridFS by its file ID."""
    try:
        oid = ObjectId(file_id)
        if not fs.exists(oid):
            return JSONResponse({"message": "Photo not found", "success": False}, status_code=404)
        grid_out = fs.get(oid)
        data = grid_out.read()
        return StreamingResponse(io.BytesIO(data), media_type="image/png")
    except Exception as e:
        logger.error(f"get_photo error: {e}")
        return JSONResponse({"message": str(e), "success": False}, status_code=500)


@app.post("/api/submit-audit")
async def submit_audit(emp_id: str = Depends(get_current_user)):
    try:
        today = datetime.now(timezone.utc).date().isoformat()
        temp_audit = temp_audit_data_collection.find_one({"user_id": emp_id, "date": today})
        if not temp_audit:
            raise HTTPException(status_code=404, detail="No audit data found to submit")
        if not all(temp_audit.get("completion_status", {}).values()):
            raise HTTPException(status_code=400, detail="Not all sections are completed")
        result = audit_data_collection.insert_one(temp_audit)
        temp_audit_data_collection.delete_one({"_id": temp_audit["_id"]})
        response = base_response.copy()
        response.update({
            "message": "Audit submitted successfully", "success": True,
            "data": {"submitted": True, "audit_id": str(result.inserted_id)},
            "status_code": 200
        })
        return JSONResponse(content=response, status_code=200)
    except Exception as e:
        logger.error(f"Error in submit_audit: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/clear-sections")
async def clear_sections(emp_id: str = Depends(get_current_user)):
    try:
        today = datetime.now(timezone.utc).date().isoformat()
        temp_audit_data_collection.delete_one({"user_id": emp_id, "date": today})
        return JSONResponse({"message": "Sections cleared", "success": True}, status_code=200)
    except Exception as e:
        return JSONResponse({"message": str(e), "success": False}, status_code=500)

# ═════════════════════════════════════════════════════════════════════════════
# ADD THIS ENDPOINT TO YOUR main.py (before the existing /api/get-location)
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/api/get-ip-location")
def get_ip_location():
    """
    Fetch user's location via IP address from backend (avoids CORS issues).
    This solves the CORS problem when geolocation API is not available in production.
    """
    services = [
        ("https://freeipapi.com/api/json", lambda d: {"lat": d.get("latitude"), "lon": d.get("longitude")} if d.get("latitude") else None),
        ("https://ipapi.co/json/", lambda d: {"lat": d.get("latitude"), "lon": d.get("longitude")} if d.get("latitude") else None),
        ("https://ip-api.com/json/?fields=lat,lon,status", lambda d: {"lat": d.get("lat"), "lon": d.get("lon")} if d.get("status") == "success" else None),
    ]
    
    for service_url, parse_fn in services:
        try:
            res = requests.get(service_url, timeout=5)
            if res.status_code == 200:
                data = res.json()
                coords = parse_fn(data)
                if coords and coords["lat"] and coords["lon"]:
                    logger.info(f"IP geolocation via {service_url}: {coords}")
                    return {"latitude": coords["lat"], "longitude": coords["lon"], "success": True}
        except Exception as e:
            logger.warning(f"IP geolocation service {service_url} failed: {e}")
    
    logger.error("All IP geolocation services failed")
    return {"success": False, "error": "Could not determine IP location"}

# ─────────────────────────────────────────────────────────────────────────────
#  LOCATION
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/get-location")
def get_location(lat: float = Query(...), lon: float = Query(...)):
    serp_url = f"https://serpapi.com/search?engine=google_maps&q={lat},{lon}&type=search&api_key={SERPAPI_KEY}"
    try:
        serp_res = requests.get(serp_url, timeout=6)
        serp_data = serp_res.json()
        if serp_res.status_code == 200 and "search_metadata" in serp_data:
            place_result = serp_data.get("place_results", {})
            plus_code = place_result.get("plus_code") or "N/A"
            address = place_result.get("title") or "N/A"
            maps_url = serp_data.get("search_metadata", {}).get("google_maps_url")
            if maps_url:
                return {"source": "serpapi", "latitude": lat, "longitude": lon, "plus_code": plus_code, "address": address, "maps_url": maps_url}
        raise Exception("SerpApi failed or incomplete")
    except Exception as e:
        print(f"⚠️ SerpApi failed: {e}")
        osm_url = f"https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat={lat}&lon={lon}"
        osm_res = requests.get(osm_url, headers={"User-Agent": "audit-app"})
        osm_data = osm_res.json()
        address = osm_data.get("display_name", "Address not found")
        plus_code = address
        maps_url = f"https://www.google.com/maps/search/{lat}%2C{lon}?hl=en"
        return {"source": "osm", "latitude": lat, "longitude": lon, "plus_code": plus_code, "address": address, "maps_url": maps_url}


# ─────────────────────────────────────────────────────────────────────────────
#  EXCEL GENERATION HELPER
# ─────────────────────────────────────────────────────────────────────────────

async def generate_excel_bytes(emp_id: str, audit_data: dict) -> bytes:
    today = datetime.now(timezone.utc).date().isoformat()
    wb = Workbook()
    wb.remove(wb.active)
    sections = audit_data.get("sections", {})

    def adjust(ws, widths):
        for col, w in enumerate(widths, start=1):
            ws.column_dimensions[get_column_letter(col)].width = w
        for row in ws.iter_rows(min_row=2):
            for cell in row:
                cell.alignment = Alignment(wrap_text=True, vertical="top")

    # General Report
    ws = wb.create_sheet("General Report")
    ws.append(["Field", "Value"])
    gr = sections.get("general_report", {})
    if gr:
        for k, v in gr.items():
            ws.append([k.replace("_", " ").title(), str(v)])
    else:
        ws.append(["No general report saved.", ""])
    adjust(ws, [40, 20])

    # Stock Reconciliation
    ws = wb.create_sheet("Stock Reconciliation")
    ws.append(["Commodity Name", "Stock Type", "Qty as per Registered", "Qty as per Physical", "Difference", "Remarks"])
    stock = sections.get("stock_reconciliation", {}).get("commodities", [])
    if stock:
        for item in stock:
            ws.append([item.get("commodity_name",""), item.get("commodity",""), item.get("qty_registered",""), item.get("qty_physical",""), item.get("difference",""), item.get("remarks","")])
    else:
        ws.append(["No stock data.", "", "", "", "", ""])
    adjust(ws, [20, 20, 20, 20, 20, 30])

    # Question-based sections
    q_sections = [
        ("observations_on_stacking", "Observations on Stacking"),
        ("observations_on_warehouse_operations", "Observations on WH Operations"),
        ("observations_on_warehouse_record_keeping", "Observations on WH Record Keeping"),
        ("observations_on_wh_infrastructure", "Observations on WH Infrastructure"),
        ("observations_on_quality_operation", "Observations on Quality Operation"),
        ("checklist_wrt_exchange_circular_mentha_oil", "Checklist Mentha Oil"),
        ("checklist_wrt_exchange_circular_metal", "Checklist Metals"),
        ("checklist_wrt_exchange_circular_cotton_bales", "Checklist Cotton Bales"),
    ]
    for key, title in q_sections:
        ws = wb.create_sheet(title)
        ws.append(["Question", "Yes/No", "Remarks"])
        qlist = sections.get(key, {}).get("questions", [])
        if qlist:
            for idx, q in enumerate(qlist, start=1):
                ws.append([f"{idx}. {q.get('question', f'Question {idx}').strip()}", q.get("answer","").strip(), q.get("remarks","").strip()])
        else:
            ws.append(["No data saved.", "", ""])
        adjust(ws, [60, 10, 30])

    # Stock Count (grouped by sheet)
    ws = wb.create_sheet("Stock Count")
    ws.append(["Sheet", "Item Code", "Item Name", "Expected Qty", "Physical Amount", "Remarks"])
    audit = audit_data
    stock_count_data = audit.get("stock_count_data", [])
    if stock_count_data:
        for item in stock_count_data:
            ws.append([item.get("sheet_name",""), item.get("item_code",""), item.get("item_name",""), item.get("qty",""), item.get("physical_amount",""), item.get("remarks","")])
    else:
        ws.append(["No stock count data.", "", "", "", "", ""])
    adjust(ws, [20, 20, 30, 15, 15, 30])

    # Signature
    ws = wb.create_sheet("Signature")
    sig = sections.get("signature", {}).get("signature")
    if sig:
        try:
            img_data = re.sub("^data:image/.+;base64,", "", sig)
            img_bytes = io.BytesIO(base64.b64decode(img_data))
            img = Image(img_bytes)
            img.width = 250; img.height = 150
            ws.add_image(img, "A1")
            ws["A3"] = "Signature captured during the audit"
        except Exception as e:
            ws["A1"] = f"Unable to embed signature: {e}"
    else:
        ws["A1"] = "Signature not found."
    ws.column_dimensions["A"].width = 60

    # Photo
    ws = wb.create_sheet("Photo")
    photo_section = sections.get("photo", {})
    photo = photo_section.get("photo")
    photo_file_id = photo_section.get("photo_file_id")
    maps_url = photo_section.get("maps_url")
    row = 1
    if maps_url:
        ws["A1"] = "Maps URL"; ws["B1"] = maps_url; row += 2

    # Resolve photo bytes: prefer GridFS, fall back to inline base64
    photo_bytes = None
    if photo_file_id:
        try:
            from bson import ObjectId as _ObjId
            grid_out = fs.get(_ObjId(photo_file_id))
            photo_bytes = grid_out.read()
        except Exception as gfs_err:
            logger.warning(f"GridFS photo fetch failed for export: {gfs_err}")
    elif photo:
        try:
            img_data = re.sub("^data:image/.+;base64,", "", photo)
            photo_bytes = base64.b64decode(img_data)
        except Exception as b64_err:
            logger.warning(f"Base64 photo decode failed for export: {b64_err}")

    if photo_bytes:
        try:
            img = Image(io.BytesIO(photo_bytes)); img.width = 350; img.height = 250
            ws.add_image(img, f"A{row}")
            ws[f"A{row + 20}"] = "Photo captured during the audit"
        except Exception as e:
            ws[f"A{row}"] = f"Unable to embed photo: {e}"
    else:
        ws[f"A{row}"] = "Photo not found."
    ws.column_dimensions["A"].width = 60
    ws.column_dimensions["B"].width = 40

    out = io.BytesIO()
    wb.save(out)
    out.seek(0)
    return out.read()


# ─────────────────────────────────────────────────────────────────────────────
#  EXPORT EXCEL
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/export-excel")
async def export_excel(emp_id: str = Depends(get_current_user)):
    try:
        today = datetime.now(timezone.utc).date().isoformat()
        # Check temp collection first (audit in progress), then submitted collection
        audit_data = temp_audit_data_collection.find_one({"user_id": emp_id, "date": today})
        if not audit_data:
            audit_data = audit_data_collection.find_one({"user_id": emp_id, "date": today})
        if not audit_data:
            return JSONResponse({"message": "No audit data for today", "success": False}, status_code=404)
        completion = audit_data.get("completion_status", {})
        expected = [
            "general_report", "stock_reconciliation",
            "observations_on_stacking", "observations_on_warehouse_operations",
            "observations_on_warehouse_record_keeping", "observations_on_wh_infrastructure",
            "observations_on_quality_operation", "checklist_wrt_exchange_circular_mentha_oil",
            "checklist_wrt_exchange_circular_metal", "checklist_wrt_exchange_circular_cotton_bales",
            "signature", "photo"
        ]
        if not all(completion.get(s, False) for s in expected):
            return JSONResponse({"message": "Complete all sections before exporting", "success": False}, status_code=400)
        excel_bytes = await generate_excel_bytes(emp_id, audit_data)
        filename = f"audit_{emp_id}_{today}.xlsx"
        return StreamingResponse(
            io.BytesIO(excel_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename*=UTF-8\'\'{filename}'}
        )
    except Exception as e:
        logger.error(f"Export-excel error: {e}")
        return JSONResponse({"message": f"Server error: {str(e)}", "success": False}, status_code=500)


# ─────────────────────────────────────────────────────────────────────────────
#  SEND EMAIL
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/send-email")
async def send_email(
    to_email: str = Form(...),
    attachment: UploadFile = File(...),
    emp_id: str = Depends(get_current_user)
):
    try:
        today = datetime.now(timezone.utc).date().isoformat()
        allowed_extensions = (".pdf", ".xlsx", ".xls")
        if not attachment.filename.lower().endswith(allowed_extensions):
            return JSONResponse({"message": "Only PDF or Excel files are allowed", "success": False}, status_code=400)
        pdf_bytes = await attachment.read()
        pdf_name = attachment.filename
        # Check temp collection first (in-progress), then submitted collection
        audit_data = audit_data_collection.find_one({"user_id": emp_id, "date": today})
        if not audit_data:
            audit_data = temp_audit_data_collection.find_one({"user_id": emp_id, "date": today})
        if not audit_data:
            return JSONResponse({"message": "No audit data for today", "success": False}, status_code=404)
        completion = audit_data.get("completion_status", {})
        expected = [
            "general_report", "stock_reconciliation",
            "observations_on_stacking", "observations_on_warehouse_operations",
            "observations_on_warehouse_record_keeping", "observations_on_wh_infrastructure",
            "observations_on_quality_operation", "checklist_wrt_exchange_circular_mentha_oil",
            "checklist_wrt_exchange_circular_metal", "checklist_wrt_exchange_circular_cotton_bales",
            "signature", "photo"
        ]
        if not all(completion.get(s, False) for s in expected):
            return JSONResponse({"message": "Complete all sections before sending e-mail", "success": False}, status_code=400)
        excel_bytes = await generate_excel_bytes(emp_id, audit_data)
        excel_name = f"audit_{emp_id}_{today}.xlsx"
        msg = EmailMessage()
        msg["Subject"] = f"Audit Report – {today}"
        msg["From"] = os.getenv("MAIL_USERNAME")
        msg["To"] = to_email
        msg["Cc"] = emp_id
        msg.set_content(f"""Dear Auditor Manager,\n\nPlease find attached:\n1. The PDF you uploaded ({pdf_name})\n2. The audit data in Excel format ({excel_name})\n\nRegards,\nAudit App (via Gmail SMTP)\n""")
        msg.add_attachment(pdf_bytes, maintype="application", subtype="pdf", filename=pdf_name)
        msg.add_attachment(excel_bytes, maintype="application", subtype="vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename=excel_name)
        with smtplib.SMTP("smtp.gmail.com", 587) as smtp:
            smtp.ehlo(); smtp.starttls()
            smtp.login(os.getenv("MAIL_USERNAME"), os.getenv("MAIL_PASSWORD"))
            smtp.send_message(msg)
        return JSONResponse({"message": "Email sent successfully", "success": True}, status_code=200)
    except Exception as e:
        logger.error(f"Send-email error: {e}")
        return JSONResponse({"message": f"Failed to send email: {str(e)}", "success": False}, status_code=500)

# ─────────────────────────────────────────────────────────────────────────────
#  UPLOAD ITEM MASTER  –  NEW JSON endpoint (called by the wizard)
# ─────────────────────────────────────────────────────────────────────────────

class SheetItemsPayload(BaseModel):
    sheet_name: str
    items: List[dict]   # each: { item_code, item_name, qty }

class UploadItemsJsonPayload(BaseModel):
    sheets: List[SheetItemsPayload]


@app.post("/api/upload-items-json")
async def upload_items_json(
    payload: UploadItemsJsonPayload,
    emp_id: str = Depends(get_current_user)
):
    """
    Accept pre-parsed item data from the frontend wizard.
    Each sheet's items are stored with a sheet_name field so the
    stock-count view can group / filter by sheet.

    All existing items are replaced on each call.
    """
    try:
        logger.info(f"upload-items-json called by {emp_id}, sheets={[s.sheet_name for s in payload.sheets]}")

        all_items = []
        sheet_summary = []

        for sheet in payload.sheets:
            sheet_name = sheet.sheet_name.strip()
            valid_items = []

            for raw in sheet.items:
                item_code = str(raw.get("item_code", "")).strip()
                item_name = str(raw.get("item_name", "")).strip()
                qty       = str(raw.get("qty", "")).strip()
                extra_col = str(raw.get("extra_col", "")).strip()

                # Skip blank / sentinel rows
                if not item_code or not item_name:
                    continue
                if item_code.lower() in ("nan", "none", "item code", ""):
                    continue
                if item_name.lower() in ("nan", "none", "item name", ""):
                    continue

                valid_items.append({
                    "item_code":   item_code,
                    "item_name":   item_name,
                    "qty":         qty,
                    "extra_col":   extra_col,
                    "sheet_name":  sheet_name,
                    "uploaded_by": emp_id,
                    "uploaded_at": datetime.now(timezone.utc),
                })

            all_items.extend(valid_items)
            sheet_summary.append({"sheet": sheet_name, "count": len(valid_items)})
            logger.info(f"  Sheet '{sheet_name}': {len(valid_items)} valid items")

        if not all_items:
            return JSONResponse(
                {"message": "No valid items found in the uploaded data. Check that Item Code and Item Name columns are not empty.", "success": False},
                status_code=400
            )

        # Store this upload in history
        upload_history_collection.insert_one({
            "uploaded_by": emp_id,
            "uploaded_at": datetime.now(timezone.utc),
            "total_items": len(all_items),
            "sheets": sheet_summary
        })

        # Replace only the sheets that were uploaded — leave other sheets untouched
        uploaded_sheet_names = [s.sheet_name.strip() for s in payload.sheets]
        item_master_collection.delete_many({"sheet_name": {"$in": uploaded_sheet_names}})
        if all_items:
            item_master_collection.insert_many(all_items)

        logger.info(f"Inserted {len(all_items)} items from {len(payload.sheets)} sheet(s)")

        return JSONResponse(
            {
                "message": f"Successfully uploaded {len(all_items)} items from {len(payload.sheets)} sheet(s)",
                "success": True,
                "data": {
                    "total_count": len(all_items),
                    "sheets": sheet_summary,
                    "sample_items": [
                        {"item_code": i["item_code"], "item_name": i["item_name"], "sheet_name": i["sheet_name"]}
                        for i in all_items[:5]
                    ]
                }
            },
            status_code=200
        )

    except Exception as e:
        logger.error(f"upload-items-json error: {e}")
        import traceback; logger.error(traceback.format_exc())
        return JSONResponse({"message": f"Failed to upload items: {str(e)}", "success": False}, status_code=500)


# ─────────────────────────────────────────────────────────────────────────────
#  LEGACY FILE-UPLOAD ENDPOINT  (kept for backward compatibility)
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/upload-items")
async def upload_items(
    file: UploadFile = File(...),
    emp_id: str = Depends(get_current_user)
):
    """Original file-upload endpoint – still works but wizard uses /api/upload-items-json instead."""
    try:
        fname = file.filename.lower()
        if not any(fname.endswith(ext) for ext in ('.xlsx', '.xls', '.xlsb', '.csv')):
            return JSONResponse({"message": "Only Excel (.xlsx/.xls/.xlsb) or CSV files are allowed", "success": False}, status_code=400)
        contents = await file.read()
        try:
            if fname.endswith('.csv'):
                df = pd.read_csv(io.BytesIO(contents))
            elif fname.endswith('.xlsb'):
                df = pd.read_excel(io.BytesIO(contents), engine='pyxlsb')
            else:
                df = pd.read_excel(io.BytesIO(contents))
        except Exception as parse_error:
            return JSONResponse({"message": f"Could not parse file: {str(parse_error)}", "success": False}, status_code=400)

        item_code_col = next((c for c in df.columns if 'item code' in str(c).lower()), None)
        item_name_col = next((c for c in df.columns if 'item name' in str(c).lower()), None)
        if not item_code_col or not item_name_col:
            return JSONResponse({"message": "Could not find 'Item Code' and 'Item Name' columns.", "success": False}, status_code=400)

        items = []
        for _, row in df.iterrows():
            code = str(row[item_code_col]).strip() if pd.notna(row[item_code_col]) else ""
            name = str(row[item_name_col]).strip() if pd.notna(row[item_name_col]) else ""
            if code and name and code.lower() not in ['nan','none','','item code'] and name.lower() not in ['nan','none','','item name']:
                items.append({"item_code": code, "item_name": name, "qty": "", "sheet_name": "Default", "uploaded_by": emp_id, "uploaded_at": datetime.now(timezone.utc)})

        if not items:
            return JSONResponse({"message": "No valid items found in the file.", "success": False}, status_code=400)

        item_master_collection.delete_many({})
        item_master_collection.insert_many(items)
        return JSONResponse({"message": f"Successfully uploaded {len(items)} items", "success": True, "data": {"count": len(items)}}, status_code=200)

    except Exception as e:
        logger.error(f"Upload items error: {e}")
        return JSONResponse({"message": f"Failed to upload items: {str(e)}", "success": False}, status_code=500)


# ─────────────────────────────────────────────────────────────────────────────
#  GET ITEMS  (stock count – now returns sheet_name + qty)
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/get-items")
async def get_items(
    search: str = Query(None),
    emp_id: str = Depends(get_current_user)
):
    try:
        query = {}
        if search:
            query = {"$or": [
                {"item_code": {"$regex": search, "$options": "i"}},
                {"item_name": {"$regex": search, "$options": "i"}}
            ]}

        # Fetch from master — include sheet_name and qty now
        items = list(item_master_collection.find(
            query,
            {"_id": 0, "item_code": 1, "item_name": 1, "sheet_name": 1, "qty": 1}
        ))

        # Get existing stock-count data for this user today
        today = datetime.now(timezone.utc).date().isoformat()
        audit = temp_audit_data_collection.find_one({"user_id": emp_id, "date": today})
        stock_count_lookup = {}
        if audit and "stock_count_data" in audit:
            for sc in audit["stock_count_data"]:
                stock_count_lookup[sc["item_code"]] = {
                    "physical_amount": sc.get("physical_amount", ""),
                    "remarks": sc.get("remarks", "")
                }

        # Merge
        for item in items:
            sc = stock_count_lookup.get(item["item_code"], {})
            item["physical_amount"] = sc.get("physical_amount", "")
            item["remarks"] = sc.get("remarks", "")
            item.setdefault("sheet_name", "")
            item.setdefault("qty", "")

        return JSONResponse(
            {"message": "Items retrieved successfully", "success": True, "data": {"items": items}},
            status_code=200
        )
    except Exception as e:
        logger.error(f"Get items error: {e}")
        return JSONResponse({"message": f"Failed to get items: {str(e)}", "success": False}, status_code=500)


# ─────────────────────────────────────────────────────────────────────────────
#  SAVE STOCK COUNT ITEM  (now persists sheet_name)
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/save-stock-count-item")
async def save_stock_count_item(request: Request, emp_id: str = Depends(get_current_user)):
    try:
        body = await request.json()
        item_code      = body.get("item_code")
        item_name      = body.get("item_name")
        sheet_name     = body.get("sheet_name", "")
        physical_amount = body.get("physical_amount", "")
        remarks        = body.get("remarks", "")

        if not item_code or not item_name:
            return JSONResponse({"message": "Item code and name are required", "success": False}, status_code=400)

        # Fetch expected qty from item master
        master = item_master_collection.find_one({"item_code": item_code}, {"_id": 0, "qty": 1})
        qty = master.get("qty", "") if master else ""

        today = datetime.now(timezone.utc).date().isoformat()
        audit = temp_audit_data_collection.find_one({"user_id": emp_id, "date": today})
        if not audit:
            audit = {
                "user_id": emp_id, "date": today, "sections": {},
                "completion_status": {}, "stock_count_data": [],
                "submitted_by": emp_id, "submitted_at": datetime.now(timezone.utc)
            }
        if "stock_count_data" not in audit:
            audit["stock_count_data"] = []

        item_found = False
        for item in audit["stock_count_data"]:
            if item["item_code"] == item_code:
                item.update({"physical_amount": physical_amount, "remarks": remarks, "item_name": item_name, "sheet_name": sheet_name, "qty": qty})
                item_found = True
                break

        if not item_found:
            audit["stock_count_data"].append({
                "item_code": item_code, "item_name": item_name,
                "sheet_name": sheet_name, "qty": qty,
                "physical_amount": physical_amount, "remarks": remarks
            })

        if audit.get("_id"):
            temp_audit_data_collection.update_one(
                {"_id": audit["_id"]},
                {"$set": {"stock_count_data": audit["stock_count_data"]}}
            )
        else:
            temp_audit_data_collection.insert_one(audit)

        return JSONResponse({"message": "Stock count item saved successfully", "success": True}, status_code=200)

    except Exception as e:
        logger.error(f"Save stock count item error: {e}")
        return JSONResponse({"message": f"Failed to save: {str(e)}", "success": False}, status_code=500)


# ─────────────────────────────────────────────────────────────────────────────
#  SUBMIT STOCK COUNT
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/submit-stock-count")
async def submit_stock_count(emp_id: str = Depends(get_current_user)):
    try:
        today = datetime.now(timezone.utc).date().isoformat()
        audit = temp_audit_data_collection.find_one({"user_id": emp_id, "date": today})
        if not audit:
            return JSONResponse({"message": "No stock count data found", "success": False}, status_code=404)
        if not audit.get("stock_count_data"):
            return JSONResponse({"message": "Please count at least one item before submitting", "success": False}, status_code=400)
        temp_audit_data_collection.update_one(
            {"_id": audit["_id"]},
            {"$set": {"completion_status.stock_count": True}}
        )
        return JSONResponse({"message": "Stock count submitted successfully", "success": True}, status_code=200)
    except Exception as e:
        logger.error(f"Submit stock count error: {e}")
# ─────────────────────────────────────────────────────────────────────────────
#  EXPORT STOCK COUNT EXCEL
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/export-stock-count-excel")
async def export_stock_count_excel(emp_id: str = Depends(get_current_user)):
    try:
        today = datetime.now(timezone.utc).date().isoformat()
        audit = temp_audit_data_collection.find_one({"user_id": emp_id, "date": today})
        if not audit or not audit.get("stock_count_data"):
            return JSONResponse({"message": "No stock count data found", "success": False}, status_code=404)
        
        completion = audit.get("completion_status", {})
        if not completion.get("stock_count", False):
            return JSONResponse({"message": "Please submit stock count before exporting", "success": False}, status_code=400)

        data = audit["stock_count_data"]
        df = pd.DataFrame(data)
        
        columns = ["sheet_name", "item_name", "item_code", "qty", "physical_amount", "remarks"]
        available_cols = [c for c in columns if c in df.columns]
        df = df[available_cols]
        df.rename(columns={
            "sheet_name": "Sheet Name", 
            "item_name": "Item Name", 
            "item_code": "Item Code", 
            "qty": "Expected Qty", 
            "physical_amount": "Physical Count", 
            "remarks": "Remarks"
        }, inplace=True)

        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Stock Count')
        excel_bytes = output.getvalue()

        filename = f"stock_count_{emp_id}_{today}.xlsx"
        return StreamingResponse(
            io.BytesIO(excel_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"}
        )
    except Exception as e:
        logger.error(f"Export stock count excel error: {e}")
        return JSONResponse({"message": f"Server error: {str(e)}", "success": False}, status_code=500)


# ─────────────────────────────────────────────────────────────────────────────
#  ADMIN ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/check-admin")
async def check_admin(emp_id: str = Depends(get_current_user)):
    try:
        is_admin = admins_collection.find_one({"email": emp_id}) is not None
        print(is_admin)
        return JSONResponse({"message": "Admin check", "success": True, "data": {"is_admin": is_admin}}, status_code=200)
    except Exception as e:
        logger.error(f"Check admin error: {e}")
        return JSONResponse({"message": f"Server error: {str(e)}", "success": False}, status_code=500)

@app.get("/api/admin/employees-stats")
async def get_employees_stats(emp_id: str = Depends(get_current_user)):
    try:
        if not admins_collection.find_one({"email": emp_id}):
            return JSONResponse({"message": "Unauthorized", "success": False}, status_code=403)
        all_users = list(users.find({}, {"_id": 0, "email": 1, "name": 1, "created_at": 1}))
        for u in all_users:
            if "created_at" in u and hasattr(u["created_at"], "isoformat"):
                u["created_at"] = u["created_at"].isoformat()
        return JSONResponse({"message": "Stats fetched", "success": True, "data": {"users": all_users, "total": len(all_users)}}, status_code=200)
    except Exception as e:
        logger.error(f"Stats error: {e}")
        return JSONResponse({"message": f"Server error: {str(e)}", "success": False}, status_code=500)

@app.get("/api/admin/checklist-data")
async def admin_checklist_data(emp_id: str = Depends(get_current_user)):
    try:
        if not admins_collection.find_one({"email": emp_id}):
            return JSONResponse({"message": "Unauthorized", "success": False}, status_code=403)
        data = list(audit_data_collection.find({}, {"_id": 0}))
        for d in data:
            if "submitted_at" in d and isinstance(d["submitted_at"], datetime):
                d["submitted_at"] = d["submitted_at"].isoformat()
        return JSONResponse({"message": "Data fetched", "success": True, "data": {"checklists": data}}, status_code=200)
    except Exception as e:
        logger.error(f"Checklist error: {e}")
        return JSONResponse({"message": f"Server error: {str(e)}", "success": False}, status_code=500)

@app.get("/api/admin/uploaded-history")
async def uploaded_history(emp_id: str = Depends(get_current_user)):
    try:
        if not admins_collection.find_one({"email": emp_id}):
            return JSONResponse({"message": "Unauthorized", "success": False}, status_code=403)
        
        # Get history
        history = list(upload_history_collection.find({}, {"_id": 0}).sort("uploaded_at", -1))
        for h in history:
            if "uploaded_at" in h and isinstance(h["uploaded_at"], datetime):
                h["uploaded_at"] = h["uploaded_at"].isoformat()
                
        # Also return current items group by sheet
        current_items = list(item_master_collection.find({}, {"_id": 0}))
        
        return JSONResponse({
            "message": "Data fetched", 
            "success": True, 
            "data": {"history": history, "current_items": current_items}
        }, status_code=200)
    except Exception as e:
        logger.error(f"Upload history error: {e}")
        return JSONResponse({"message": f"Server error: {str(e)}", "success": False}, status_code=500)


# ─────────────────────────────────────────────────────────────────────────────
#  AUDIT COMPLETION DASHBOARD
# ─────────────────────────────────────────────────────────────────────────────

CHECKLIST_SECTIONS = [
    "general_report", "stock_reconciliation",
    "observations_on_stacking", "observations_on_warehouse_operations",
    "observations_on_warehouse_record_keeping", "observations_on_wh_infrastructure",
    "observations_on_quality_operation", "checklist_wrt_exchange_circular_mentha_oil",
    "checklist_wrt_exchange_circular_metal", "checklist_wrt_exchange_circular_cotton_bales",
    "signature", "photo"
]

@app.get("/api/admin/audit-dashboard")
async def audit_dashboard(emp_id: str = Depends(get_current_user)):
    try:
        if not admins_collection.find_one({"email": emp_id}):
            return JSONResponse({"message": "Unauthorized", "success": False}, status_code=403)

        # Submitted audits
        submitted = list(audit_data_collection.find({}, {"_id": 0, "user_id": 1, "date": 1,
                                                          "completion_status": 1, "stock_count_data": 1,
                                                          "submitted_at": 1, "sections": 1}))
        # In-progress audits
        in_progress = list(temp_audit_data_collection.find({}, {"_id": 0, "user_id": 1, "date": 1,
                                                                  "completion_status": 1, "stock_count_data": 1, "sections": 1}))

        def build_row(d, is_submitted):
            cs = d.get("completion_status", {})
            checklist_done = sum(1 for s in CHECKLIST_SECTIONS if cs.get(s, False))
            checklist_total = len(CHECKLIST_SECTIONS)
            
            # Checklist status logic
            if is_submitted:
                checklist_status = "Submitted"
            elif checklist_done == 0:
                checklist_status = "Pending"
            else:
                checklist_status = "In Progress"
            
            # Stock count
            sc_items = len(d.get("stock_count_data", []))
            sc_submitted = cs.get("stock_count", False)
            sc_status = "Submitted" if sc_submitted else "In Progress"
            
            wh_name = (d.get("sections") or {}).get("general_report", {}).get("warehouse_name", "—")
            submitted_at = d.get("submitted_at", "")
            if isinstance(submitted_at, datetime):
                submitted_at = submitted_at.isoformat()
            return {
                "user_id": d.get("user_id", ""),
                "date": d.get("date", ""),
                "warehouse_name": wh_name,
                "checklist_completed": checklist_done,
                "checklist_total": checklist_total,
                "checklist_pct": round(checklist_done / checklist_total * 100) if checklist_total > 0 else 0,
                "checklist_status": checklist_status,
                "stock_count_items": sc_items,
                "stock_count_submitted": sc_submitted,
                "stock_count_status": sc_status,
                "submitted_at": submitted_at,
            }

        rows = [build_row(d, True) for d in submitted]
        rows += [build_row(d, False) for d in in_progress]
        rows.sort(key=lambda r: (r["date"], r["user_id"]), reverse=True)

        return JSONResponse({"message": "Dashboard data fetched", "success": True,
                             "data": {"rows": rows, "checklist_sections": CHECKLIST_SECTIONS}}, status_code=200)
    except Exception as e:
        logger.error(f"Audit dashboard error: {e}")
        return JSONResponse({"message": f"Server error: {str(e)}", "success": False}, status_code=500)


# ─────────────────────────────────────────────────────────────────────────────
#  WAREHOUSE MASTER
# ─────────────────────────────────────────────────────────────────────────────

class WarehouseItem(BaseModel):
    warehouse_name: str
    warehouse_address: str

class WarehouseMasterPayload(BaseModel):
    warehouses: List[WarehouseItem]

@app.post("/api/admin/warehouse-master")
async def upload_warehouse_master(payload: WarehouseMasterPayload, emp_id: str = Depends(get_current_user)):
    try:
        if not admins_collection.find_one({"email": emp_id}):
            return JSONResponse({"message": "Unauthorized", "success": False}, status_code=403)
        if not payload.warehouses:
            return JSONResponse({"message": "No warehouse data provided", "success": False}, status_code=400)
        docs = [{"warehouse_name": w.warehouse_name.strip(),
                 "warehouse_address": w.warehouse_address.strip(),
                 "uploaded_by": emp_id,
                 "uploaded_at": datetime.now(timezone.utc)} for w in payload.warehouses
                if w.warehouse_name.strip()]
        warehouse_master_collection.delete_many({})
        warehouse_master_collection.insert_many(docs)
        return JSONResponse({"message": f"{len(docs)} warehouses uploaded successfully",
                             "success": True, "data": {"count": len(docs)}}, status_code=200)
    except Exception as e:
        logger.error(f"Warehouse master upload error: {e}")
        return JSONResponse({"message": f"Server error: {str(e)}", "success": False}, status_code=500)

@app.get("/api/admin/warehouse-master")
async def get_warehouse_master_admin(emp_id: str = Depends(get_current_user)):
    try:
        if not admins_collection.find_one({"email": emp_id}):
            return JSONResponse({"message": "Unauthorized", "success": False}, status_code=403)
        warehouses = list(warehouse_master_collection.find({}, {"_id": 0, "warehouse_name": 1, "warehouse_address": 1}))
        return JSONResponse({"message": "Warehouses fetched", "success": True,
                             "data": {"warehouses": warehouses}}, status_code=200)
    except Exception as e:
        return JSONResponse({"message": f"Server error: {str(e)}", "success": False}, status_code=500)

@app.get("/api/warehouses")
async def get_warehouses(emp_id: str = Depends(get_current_user)):
    """Public endpoint for users to fetch warehouse list for the dropdown."""
    try:
        warehouses = list(warehouse_master_collection.find({}, {"_id": 0, "warehouse_name": 1, "warehouse_address": 1}))
        return JSONResponse({"message": "Warehouses fetched", "success": True,
                             "data": {"warehouses": warehouses}}, status_code=200)
    except Exception as e:
        return JSONResponse({"message": f"Server error: {str(e)}", "success": False}, status_code=500)

@app.get("/api/admin/analytics")
async def admin_analytics(start_date: str = None, end_date: str = None, emp_id: str = Depends(get_current_user)):
    """Analytics endpoint for admin dashboard with interactive graphs."""
    try:
        if not admins_collection.find_one({"email": emp_id}):
            return JSONResponse({"message": "Unauthorized", "success": False}, status_code=403)
        
        from datetime import datetime, timedelta
        from collections import defaultdict
        
        # Parse date range
        if not start_date:
            start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        if not end_date:
            end_date = datetime.now().strftime("%Y-%m-%d")
        
        # Fetch all audits in date range (both temp and submitted)
        query = {"date": {"$gte": start_date, "$lte": end_date}}
        temp_audits = list(temp_audit_data_collection.find(query))
        submitted_audits = list(audit_data_collection.find(query))
        all_audits = temp_audits + submitted_audits
        
        # Calculate metrics
        total_audits = len(all_audits)
        completed_audits = len([a for a in all_audits if a.get("submitted_at")])
        completion_rate = round((completed_audits / total_audits * 100) if total_audits > 0 else 0, 1)
        
        # Average sections completed
        total_sections = 0
        for audit in all_audits:
            comp_status = audit.get("completion_status", {})
            total_sections += sum(1 for v in comp_status.values() if v)
        avg_sections = total_sections / total_audits if total_audits > 0 else 0
        
        # Total stock items counted
        total_stock_items = sum(len(a.get("stock_count_data", [])) for a in all_audits)
        
        # Audits by date (timeline)
        audits_by_date = defaultdict(int)
        for audit in all_audits:
            audits_by_date[audit.get("date", "Unknown")] += 1
        audits_timeline = [{"date": k, "count": v} for k, v in sorted(audits_by_date.items())]
        
        # Completion by user
        user_stats = defaultdict(lambda: {"total": 0, "completed": 0})
        for audit in all_audits:
            user = audit.get("user_id", "Unknown")
            user_stats[user]["total"] += 1
            if audit.get("submitted_at"):
                user_stats[user]["completed"] += 1
        completion_by_user = [{"user": k, "total": v["total"], "completed": v["completed"]} 
                               for k, v in user_stats.items()]
        
        # Warehouse distribution
        warehouse_dist = defaultdict(int)
        for audit in all_audits:
            wh = audit.get("warehouse_name") or audit.get("general_report", {}).get("warehouse_name", "Unknown")
            warehouse_dist[wh] += 1
        warehouse_distribution = [{"warehouse": k, "count": v} for k, v in warehouse_dist.items()]
        
        # Section breakdown (completed, in progress, pending)
        section_stats = {"completed": 0, "in_progress": 0, "pending": 0}
        for audit in all_audits:
            comp_status = audit.get("completion_status", {})
            completed_count = sum(1 for v in comp_status.values() if v)
            total_count = len(comp_status)
            
            if completed_count == total_count and completed_count > 0:
                section_stats["completed"] += 1
            elif completed_count > 0:
                section_stats["in_progress"] += 1
            else:
                section_stats["pending"] += 1
        
        return JSONResponse({
            "message": "Analytics data fetched",
            "success": True,
            "data": {
                "total_audits": total_audits,
                "completion_rate": completion_rate,
                "avg_sections": avg_sections,
                "total_stock_items": total_stock_items,
                "audits_by_date": audits_timeline,
                "completion_by_user": completion_by_user,
                "warehouse_distribution": warehouse_distribution,
                "section_breakdown": section_stats
            }
        }, status_code=200)
    except Exception as e:
        logger.error(f"Analytics error: {e}")
        return JSONResponse({"message": f"Server error: {str(e)}", "success": False}, status_code=500)

@app.get("/api/admin/warehouse-status")
async def admin_warehouse_status(date: str = None, emp_id: str = Depends(get_current_user)):
    """Get audit status for each warehouse - shows which warehouses have completed audits, in progress, or not started."""
    try:
        if not admins_collection.find_one({"email": emp_id}):
            return JSONResponse({"message": "Unauthorized", "success": False}, status_code=403)
        
        from datetime import datetime
        
        # Use today's date if not provided
        if not date:
            date = datetime.now().strftime("%Y-%m-%d")
        
        # Get all warehouses from warehouse master
        all_warehouses = list(warehouse_master_collection.find({}, {"_id": 0, "warehouse_name": 1, "warehouse_address": 1}))
        
        # Get audits for the specified date (both temp and submitted)
        temp_audits = list(temp_audit_data_collection.find({"date": date}))
        submitted_audits = list(audit_data_collection.find({"date": date}))
        all_audits = temp_audits + submitted_audits
        
        # Build warehouse status map
        warehouse_status_map = {}
        
        for audit in all_audits:
            wh_name = audit.get("warehouse_name") or audit.get("general_report", {}).get("warehouse_name")
            if not wh_name:
                continue
            
            # If warehouse not in map yet, initialize it
            if wh_name not in warehouse_status_map:
                warehouse_status_map[wh_name] = {
                    "warehouse_name": wh_name,
                    "warehouse_address": "",
                    "status": "Not Started",
                    "assigned_users": [],
                    "progress_percentage": 0,
                    "last_updated": None,
                    "audit_id": None
                }
            
            # Update status based on audit
            user_id = audit.get("user_id")
            if user_id and user_id not in warehouse_status_map[wh_name]["assigned_users"]:
                warehouse_status_map[wh_name]["assigned_users"].append(user_id)
            
            # Calculate progress
            comp_status = audit.get("completion_status", {})
            if comp_status:
                completed = sum(1 for v in comp_status.values() if v)
                total = len(comp_status)
                progress = round((completed / total * 100) if total > 0 else 0)
                
                # Update if this audit has better progress
                if progress > warehouse_status_map[wh_name]["progress_percentage"]:
                    warehouse_status_map[wh_name]["progress_percentage"] = progress
                    warehouse_status_map[wh_name]["audit_id"] = str(audit.get("_id", ""))
                
                # Determine status
                if audit.get("submitted_at"):
                    warehouse_status_map[wh_name]["status"] = "Completed"
                elif completed > 0:
                    if warehouse_status_map[wh_name]["status"] != "Completed":
                        warehouse_status_map[wh_name]["status"] = "In Progress"
            
            # Update last_updated
            updated_at = audit.get("submitted_at") or audit.get("date")
            if updated_at:
                if not warehouse_status_map[wh_name]["last_updated"] or updated_at > warehouse_status_map[wh_name]["last_updated"]:
                    warehouse_status_map[wh_name]["last_updated"] = updated_at
        
        # Add warehouses from master that don't have audits
        for wh in all_warehouses:
            wh_name = wh.get("warehouse_name")
            if wh_name not in warehouse_status_map:
                warehouse_status_map[wh_name] = {
                    "warehouse_name": wh_name,
                    "warehouse_address": wh.get("warehouse_address", ""),
                    "status": "Not Started",
                    "assigned_users": [],
                    "progress_percentage": 0,
                    "last_updated": None,
                    "audit_id": None
                }
            else:
                # Update address from master
                warehouse_status_map[wh_name]["warehouse_address"] = wh.get("warehouse_address", "")
        
        # Convert to list and sort by status priority (Completed, In Progress, Not Started)
        status_priority = {"Completed": 1, "In Progress": 2, "Not Started": 3}
        warehouse_list = sorted(
            warehouse_status_map.values(),
            key=lambda x: (status_priority.get(x["status"], 4), x["warehouse_name"])
        )
        
        return JSONResponse({
            "message": "Warehouse status fetched",
            "success": True,
            "data": {
                "warehouses": warehouse_list,
                "date": date
            }
        }, status_code=200)
    except Exception as e:
        logger.error(f"Warehouse status error: {e}")
        return JSONResponse({"message": f"Server error: {str(e)}", "success": False}, status_code=500)


# ─────────────────────────────────────────────────────────────────────────────
#  USER DASHBOARD HISTORY
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/user/checklist-history")
async def user_checklist_history(emp_id: str = Depends(get_current_user)):
    """Get all submitted checklists for the current user."""
    try:
        history = list(audit_data_collection.find(
            {"user_id": emp_id},
            {"_id": 0, "date": 1, "submitted_at": 1, "sections": 1, "completion_status": 1}
        ).sort("date", -1))
        
        for h in history:
            if "submitted_at" in h and isinstance(h["submitted_at"], datetime):
                h["submitted_at"] = h["submitted_at"].isoformat()
            wh_name = (h.get("sections") or {}).get("general_report", {}).get("warehouse_name", "—")
            h["warehouse_name"] = wh_name
            cs = h.get("completion_status", {})
            h["sections_completed"] = sum(1 for s in CHECKLIST_SECTIONS if cs.get(s, False))
            h["sections_total"] = len(CHECKLIST_SECTIONS)
        
        return JSONResponse({"message": "History fetched", "success": True,
                             "data": {"history": history}}, status_code=200)
    except Exception as e:
        logger.error(f"Checklist history error: {e}")
        return JSONResponse({"message": f"Server error: {str(e)}", "success": False}, status_code=500)


@app.get("/api/user/stock-count-history")
async def user_stock_count_history(emp_id: str = Depends(get_current_user)):
    """Get all stock count records (pending, completed, history) for the current user."""
    try:
        today = datetime.now(timezone.utc).date().isoformat()
        
        # Current in-progress (temp collection)
        current_temp = temp_audit_data_collection.find_one({"user_id": emp_id, "date": today})
        pending_items = []
        if current_temp:
            wh_name = (current_temp.get("sections") or {}).get("general_report", {}).get("warehouse_name", "—")
            sc_data = current_temp.get("stock_count_data", [])
            pending_items = [{
                "date": current_temp.get("date"),
                "warehouse_name": wh_name,
                "items_count": len(sc_data),
                "status": "Pending",
                "stock_count_data": sc_data
            }]
        
        # Completed (submitted today - in audit_data_collection)
        completed_today = audit_data_collection.find_one({"user_id": emp_id, "date": today})
        completed_items = []
        if completed_today:
            wh_name = (completed_today.get("sections") or {}).get("general_report", {}).get("warehouse_name", "—")
            sc_data = completed_today.get("stock_count_data", [])
            submitted_at = completed_today.get("submitted_at", "")
            if isinstance(submitted_at, datetime):
                submitted_at = submitted_at.isoformat()
            completed_items = [{
                "date": completed_today.get("date"),
                "warehouse_name": wh_name,
                "items_count": len(sc_data),
                "status": "Completed",
                "submitted_at": submitted_at,
                "stock_count_data": sc_data
            }]
        
        # History (all past submitted audits)
        history = list(audit_data_collection.find(
            {"user_id": emp_id},
            {"_id": 0, "date": 1, "submitted_at": 1, "sections": 1, "stock_count_data": 1}
        ).sort("date", -1))
        
        history_items = []
        for h in history:
            wh_name = (h.get("sections") or {}).get("general_report", {}).get("warehouse_name", "—")
            sc_data = h.get("stock_count_data", [])
            submitted_at = h.get("submitted_at", "")
            if isinstance(submitted_at, datetime):
                submitted_at = submitted_at.isoformat()
            history_items.append({
                "date": h.get("date"),
                "warehouse_name": wh_name,
                "items_count": len(sc_data),
                "status": "Submitted",
                "submitted_at": submitted_at,
                "stock_count_data": sc_data
            })
        
        return JSONResponse({"message": "Stock count data fetched", "success": True,
                             "data": {
                                 "pending": pending_items,
                                 "completed": completed_items,
                                 "history": history_items
                             }}, status_code=200)
    except Exception as e:
        logger.error(f"Stock count history error: {e}")
        return JSONResponse({"message": f"Server error: {str(e)}", "success": False}, status_code=500)

# ─────────────────────────────────────────────────────────────────────────────
#  STATIC HTML ROUTES
# ─────────────────────────────────────────────────────────────────────────────

def get_token(request: Request) -> str:
    token = request.cookies.get("access_token") 
    if token:
        return token
    auth = request.headers.get("Authorization")
    if auth and auth.startswith("Bearer "):
        return auth.split(" ")[1]
    raise HTTPException(status_code=401, detail="Could not validate credentials")


@app.get("/", response_class=FileResponse)
async def root(request: Request):
    try:
        token = get_token(request)
        get_current_user(token)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))
    except HTTPException:
        return RedirectResponse(url="/login")

@app.get("/login", response_class=FileResponse)
async def serve_login():
    return FileResponse(os.path.join(STATIC_DIR, "login.html"))

@app.get("/register", response_class=FileResponse)
async def serve_register():
    return FileResponse(os.path.join(STATIC_DIR, "register.html"))
