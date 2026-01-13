import datetime
import os
import re
from typing import Dict, Optional
from datetime import timezone
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, Request, Response, status, Query, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from passlib.context import CryptContext
import logging
import requests
from app.auth import *
from app.database import *
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

# CORS configuration (explicit origin for frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

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


@app.post("/api/register")
async def register(user: UserRegister):
    logger.info(f"Register attempt for email: {user.email}")
    logger.info(f"User details: Name: {user.name}, Email: {user.email}, Password: {user.password}")
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
        print(existing_user)
        if existing_user:
            logger.warning(f"Email already registered: {user.email}")
            return JSONResponse(
                content={"message": "Email already registered", "success": False},
                status_code=status.HTTP_400_BAD_REQUEST
            )

        # hashed_password = pwd_context.hash(user.password[:72])
        # users.insert_one({
        #     "name": user.name,
        #     "email": user.email,
        #     "password_hash": hashed_password,
        #     "created_at": datetime.now(timezone.utc),
        # })
        
        hashed_password = bcrypt.hashpw(
            user.password.encode("utf-8"),
            bcrypt.gensalt()
        ).decode("utf-8")

        users.insert_one({
            "name": user.name,
            "email": user.email,
            "password_hash": hashed_password,
            "created_at": datetime.now(timezone.utc),
        })

        return JSONResponse(
            content={
                "message": "User registered successfully",
                "success": True,
                "data": {"email": user.email}
            },
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
    logger.info(f"Email: {user.email}, Password: {user.password}")
    try:
        db_user = users.find_one({"email": user.email})
        
        print(f"type(users): {type(users)}")
        print(f"type(db_user): {type(db_user)}")
        print(f"repr(db_user): {repr(db_user)}")
        logger.info(f"type(users): {type(users)}")
        logger.info(f"type(db_user): {type(db_user)}")
        logger.info(f"repr(db_user): {repr(db_user)}")
        logger.info("User found")
        print("Db User: ", db_user)
        # if not db_user or not pwd_context.verify(user.password, db_user["password_hash"]):
        #     logger.info("User not found")
        #     logger.warning(f"Invalid credentials for email: {user.email}")
        #     return JSONResponse(
        #         content={"message": "Invalid email or password", "success": False},
        #         status_code=status.HTTP_401_UNAUTHORIZED
        #     )
        
        logger.info("Getting password and hash")
        password = user.password
        password_hash = db_user["password_hash"]
        logger.info(f"Password Hash from DB: {password_hash}")

        if not bcrypt.checkpw(
            password.encode("utf-8"),
            password_hash.encode("utf-8")
        ):
            
            return JSONResponse(
                {"message": "Invalid email or password", "success": False},
                status_code=401
            )

        # if not pwd_context.verify(password, password_hash):
        #     return JSONResponse(
        #         content={"message": "Invalid email or password", "success": False},
        #         status_code=401
        #     )

        token = create_jwt({"sub": user.email})
        logger.info("Login successful, token generated")
        return JSONResponse(
            content={
                "message": "Logged in successfully",
                "success": True,
                "data": {"access_token": token}
            },
            status_code=status.HTTP_200_OK
        )

    except Exception as e:
        logger.error(f"Error in login: {str(e)}")
        return JSONResponse(
            content={"message": f"Server error: {str(e)}", "success": False},
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@app.get("/api/me")
async def get_me(emp_id: str = Depends(get_current_user)):
    logger.info(f"Fetching user info for emp_id: {emp_id}")
    try:
        user = users.find_one({"email": emp_id})
        if not user:
            response.update({
                "message": "User not found",
                "status_code": status.HTTP_404_NOT_FOUND
            })
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=response)

        response = base_response.copy()
        response.update({
            "message": "User info retrieved successfully",
            "success": True,
            "data": {"email": user["email"], "name": user.get("name", "Unknown")},
            "status_code": status.HTTP_200_OK
        })
        logger.info(f"User info retrieved: {response}")
        return JSONResponse(content=response, status_code=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Error in get_me: {str(e)}")
        response = base_response.copy()
        response.update({
            "message": f"Server error: {str(e)}",
            "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR
        })
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=response)

@app.get("/api/get-sections")
async def get_sections(emp_id: str = Depends(get_current_user)):
    logger.info(f"Fetching sections for emp_id: {emp_id}")
    try:
        today = datetime.now(timezone.utc).date().isoformat()
        audit = temp_audit_data_collection.find_one({"user_id": emp_id, "date": today})
        # if not audit:
        #     audit = await audit_data_collection.find_one({"user_id": emp_id, "date": today})
            
        completion_status = {
            "general_report": audit["completion_status"].get("general_report", False) if audit and "completion_status" in audit else False,
            "stock_reconciliation": audit["completion_status"].get("stock_reconciliation", False) if audit and "completion_status" in audit else False,
            "stock_commodity": audit["completion_status"].get("stock_commodity", False) if audit and "completion_status" in audit else False,
            "observations_on_stacking": audit["completion_status"].get("observations_on_stacking", False) if audit and "completion_status" in audit else False,
            "observations_on_warehouse_operations": audit["completion_status"].get("observations_on_warehouse_operations", False) if audit and "completion_status" in audit else False,
            "observations_on_warehouse_record_keeping": audit["completion_status"].get("observations_on_warehouse_record_keeping", False) if audit and "completion_status" in audit else False,
            "observations_on_wh_infrastructure": audit["completion_status"].get("observations_on_wh_infrastructure", False) if audit and "completion_status" in audit else False,
            "observations_on_quality_operation": audit["completion_status"].get("observations_on_quality_operation", False) if audit and "completion_status" in audit else False,
            "checklist_wrt_exchange_circular_mentha_oil": audit["completion_status"].get("checklist_wrt_exchange_circular_mentha_oil", False) if audit and "completion_status" in audit else False,
            "checklist_wrt_exchange_circular_metal": audit["completion_status"].get("checklist_wrt_exchange_circular_metal", False) if audit and "completion_status" in audit else False,
            "checklist_wrt_exchange_circular_cotton_bales": audit["completion_status"].get("checklist_wrt_exchange_circular_cotton_bales", False) if audit and "completion_status" in audit else False,
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
        response = base_response.copy()
        response.update({
            "message": f"Server error: {str(e)}",
            "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR
        })
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=response)

@app.get("/api/get-section/{section_name}")
async def get_section(section_name: str, emp_id: str = Depends(get_current_user)):
    logger.info(f"Fetching section {section_name} for emp_id: {emp_id}")
    try:
        today = datetime.now(timezone.utc).date().isoformat()
        audit = temp_audit_data_collection.find_one({"user_id": emp_id, "date": today})
        section_data = audit["sections"][section_name] if audit and section_name in audit["sections"] else {}
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
        response = base_response.copy()
        response.update({
            "message": f"Server error: {str(e)}",
            "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR
        })
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=response)

@app.post("/api/save-section")
async def save_section(request: Request, emp_id: str = Depends(get_current_user)):
    logger.info(f"Saving section for emp_id: {emp_id}")
    try:
        body = await request.json()
        section = body.get("section")
        data = body.get("data")
        date = body.get("date")
        print(data)

        if not section or not data or not date:
            return JSONResponse(
                content={"message": "Missing required fields (section, data, date)", "success": False},
                status_code=status.HTTP_400_BAD_REQUEST
            )

        audit = temp_audit_data_collection.find_one({"user_id": emp_id, "date": date})
        if not audit:
            audit = {
                "user_id": emp_id,
                "date": date,
                "sections": {},
                "completion_status": {},
                "submitted_by": emp_id,
                "submitted_at": datetime.now(timezone.utc)
            }

        audit["sections"][section] = data
        audit["completion_status"][section] = True

        if audit.get("_id"):
            temp_audit_data_collection.update_one(
                {"_id": audit["_id"]},
                {"$set": {
                    "sections": audit["sections"],
                    "completion_status": audit["completion_status"]
                }}
            )
        else:
            temp_audit_data_collection.insert_one(audit)

        response = base_response.copy()
        response.update({
            "message": f"Section {section} saved successfully",
            "success": True,
            "data": {"completion_status": audit["completion_status"]},
            "status_code": status.HTTP_200_OK
        })
        return JSONResponse(content=response, status_code=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Error in save_section: {str(e)}")
        response = base_response.copy()
        response.update({
            "message": f"Server error: {str(e)}",
            "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR
        })
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=response)

@app.post("/api/submit-audit")
async def submit_audit(emp_id: str = Depends(get_current_user)):
    logger.info(f"Submitting audit for emp_id: {emp_id}")
    try:
        today = datetime.now(timezone.utc).date().isoformat()
        temp_audit = temp_audit_data_collection.find_one({"user_id": emp_id, "date": today})
        if not temp_audit:
            response = base_response.copy()
            response.update({
                "message": "No audit data found to submit",
                "status_code": status.HTTP_404_NOT_FOUND
            })
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=response)

        if not all(temp_audit.get("completion_status", {}).values()):
            response = base_response.copy()
            response.update({
                "message": "Not all sections are completed",
                "status_code": status.HTTP_400_BAD_REQUEST
            })
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=response)

        # Copy to main collection
        result = audit_data_collection.insert_one(temp_audit)
        # Delete from temp
        temp_audit_data_collection.delete_one({"_id": temp_audit["_id"]})

        response = base_response.copy()
        response.update({
            "message": "Audit submitted successfully",
            "success": True,
            "data": {"submitted": True, "audit_id": str(result.inserted_id)},
            "status_code": status.HTTP_200_OK
        })
        logger.info(f"Audit submitted: {response}")
        return JSONResponse(content=response, status_code=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Error in submit_audit: {str(e)}")
        response = base_response.copy()
        response.update({
            "message": f"Server error: {str(e)}",
            "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR
        })
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=response)

@app.post("/api/logout")
async def logout(emp_id: str = Depends(get_current_user)):
    logger.info(f"Logging out user: {emp_id}")
    try:
        response_data = base_response.copy()
        response_data.update({
            "message": "Logged out successfully",
            "success": True,
            "data": None,
            "status_code": status.HTTP_200_OK
        })
        logger.info(f"Logout response: {response_data}")
        return JSONResponse(content=response_data, status_code=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Error in logout: {str(e)}")
        response_data = base_response.copy()
        response_data.update({
            "message": f"Server error: {str(e)}",
            "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR
        })
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=response_data)
    


@app.get("/api/get-location")
def get_location(lat: float = Query(...), lon: float = Query(...)):
    serp_url = f"https://serpapi.com/search?engine=google_maps&q={lat},{lon}&type=search&api_key={SERPAPI_KEY}"

    try:
        # ---- Try SerpApi ----
        serp_res = requests.get(serp_url, timeout=6)
        serp_data = serp_res.json()

        if serp_res.status_code == 200 and ("search_metadata" in serp_data):
            place_result = serp_data.get("place_results", {})
            plus_code = place_result.get("plus_code") or "N/A"
            address = place_result.get("title") or "N/A"
            maps_url = serp_data.get("search_metadata", {}).get("google_maps_url")

            if maps_url:
                return {
                    "source": "serpapi",
                    "latitude": lat,
                    "longitude": lon,
                    "plus_code": plus_code,
                    "address": address,
                    "maps_url": maps_url
                }

        # else fallback to OSM
        raise Exception("SerpApi failed or incomplete")

    except Exception as e:
        print(f"⚠️ SerpApi failed: {e}")

        # ---- Try OSM Fallback ----
        osm_url = f"https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat={lat}&lon={lon}"
        osm_res = requests.get(osm_url, headers={"User-Agent": "audit-app"})
        osm_data = osm_res.json()
        print(osm_data)

        address = osm_data.get("display_name", "Address not found")
        # plus_code = osm_data.get("address", {}).get("postcode", "Not available")
        plus_code = address

        maps_url = f"https://www.google.com/maps/search/{lat}%2C{lon}?hl=en"

        return {
            "source": "osm",
            "latitude": lat,
            "longitude": lon,
            "plus_code": plus_code,
            "address": address,
            "maps_url": maps_url
        }
        
@app.get("/api/export-word")
async def export_word(emp_id: str = Depends(get_current_user)):
    logger.info(f"Export Word requested by: {emp_id}")
    try:
        today = datetime.now(timezone.utc).date().isoformat()
        audit_data = temp_audit_data_collection.find_one({"user_id": emp_id, "date": today})

        if not audit_data:
            # audit_data = temp_audit_data_collection.find_one({"user_id": emp_id, "date": today})
            # if not audit_data:
            return JSONResponse(
                content={"message": "No audit data found for today to export", "success": False},
                status_code=status.HTTP_404_NOT_FOUND
            )

        completion = audit_data.get("completion_status", {})
        # expected_sections = [
        #     "general_report", "observations_on_stacking", "observations_on_warehouse_operations",
        #     "observations_on_warehouse_record_keeping", "observations_on_wh_infrastructure",
        #     "observations_on_quality_operation", "checklist_wrt_exchange_circular_mentha_oil",
        #     "checklist_wrt_exchange_circular_metal", "checklist_wrt_exchange_circular_cotton_bales",
        #     "signature", "photo"
        # ]
        
        expected_sections = [
            "general_report", 'stock_reconciliation', 'stock_commodity', "observations_on_stacking", "observations_on_warehouse_operations",
            "observations_on_warehouse_record_keeping", "observations_on_wh_infrastructure",
            "observations_on_quality_operation", "checklist_wrt_exchange_circular_mentha_oil",
            "checklist_wrt_exchange_circular_metal", "checklist_wrt_exchange_circular_cotton_bales",
            "signature", "photo"
        ]
        all_completed = all(completion.get(s, False) for s in expected_sections)

        if not all_completed:
            return JSONResponse(
                content={"message": "Not all sections are completed. Please complete all sections before exporting.", "success": False},
                status_code=status.HTTP_400_BAD_REQUEST
            )

        # ===== Build Word Document =====
        doc = Document()

        # Title and metadata
        doc.add_heading("Audit Report", level=1)
        doc.add_paragraph(f"User: {emp_id}")
        doc.add_paragraph(f"Date: {today}")
        doc.add_paragraph(" ")

        # --- Helper for formatted section ---
        def add_section(title: str, paragraphs: list):
            doc.add_heading(title, level=2)
            for text in paragraphs:
                para = doc.add_paragraph()
                run = para.add_run(text)
                run.font.size = Pt(11)
            doc.add_paragraph(" ")

        sections = audit_data.get("sections", {})

        # --- General Report Section ---
        gr = sections.get("general_report", {})
        general_paragraphs = []
        if gr:
            for k, v in gr.items():
                general_paragraphs.append(f"{k.replace('_', ' ').title()}: {v}")
        else:
            general_paragraphs.append("No general report saved.")
        add_section("General Report", general_paragraphs)

        # --- Question-Based Sections ---
        question_sections = [
            ("observations_on_stacking", "Observations on Stacking"),
            ("observations_on_warehouse_operations", "Observations on Warehouse Operations"),
            ("observations_on_warehouse_record_keeping", "Observations on Warehouse Record Keeping"),
            ("observations_on_wh_infrastructure", "Observations on WH Infrastructure"),
            ("observations_on_quality_operation", "Observations on Quality Operation"),
            ("checklist_wrt_exchange_circular_mentha_oil", "Checklist: Mentha Oil"),
            ("checklist_wrt_exchange_circular_metal", "Checklist: Metals"),
            ("checklist_wrt_exchange_circular_cotton_bales", "Checklist: Cotton Bales"),
        ]

        for key, title in question_sections:
            qlist = sections.get(key, {}).get("questions", [])
            if not qlist:
                add_section(title, ["No data saved."])
                continue

            doc.add_heading(title, level=2)
            for idx, q in enumerate(qlist, start=1):
                q_text = (q.get("question") or f"Question {idx}").strip()
                answer = q.get("answer", "").strip()
                remarks = q.get("remarks", "").strip()

                p = doc.add_paragraph()
                p.add_run(f"{idx}. {q_text}\n").bold = True
                p.add_run(f"Answer: {answer}\n")
                if remarks:
                    p.add_run(f"Remarks: {remarks}\n")
                doc.add_paragraph(" ")

        # === Signature Section ===
        sig = sections.get("signature", {}).get("signature")
        doc.add_heading("Signature", level=2)
        if sig:
            try:
                img_data = re.sub("^data:image/.+;base64,", "", sig)
                img_bytes = io.BytesIO(base64.b64decode(img_data))
                doc.add_paragraph("Below is the signature captured during the audit:")
                doc.add_picture(img_bytes, width=Inches(2.5))
            except Exception as e:
                doc.add_paragraph(f"⚠️ Unable to embed signature image: {e}")
        else:
            doc.add_paragraph("Signature not found in the audit record.")
        doc.add_paragraph(" ")

        # === Photo Section ===
        photo_data = sections.get("photo", {}).get("photo")
        maps_url = sections.get("photo", {}).get("maps_url")
        doc.add_heading("Photo", level=2)
        if maps_url:
            doc.add_paragraph(f"Maps URL: {maps_url}")
        if photo_data:
            try:
                img_data = re.sub("^data:image/.+;base64,", "", photo_data)
                img_bytes = io.BytesIO(base64.b64decode(img_data))
                doc.add_paragraph("Below is the photo captured during the audit:")
                doc.add_picture(img_bytes, width=Inches(3.5))
            except Exception as e:
                doc.add_paragraph(f"⚠️ Unable to embed photo image: {e}")
        else:
            doc.add_paragraph("Photo not found in the audit record.")
        doc.add_paragraph(" ")

        # Footer
        doc.add_paragraph("Report generated by Audit App")

        # --- Stream the file back ---
        file_stream = io.BytesIO()
        doc.save(file_stream)
        file_stream.seek(0)
        filename = f"audit_{emp_id}_{today}.docx"
        headers = {"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"}

        return StreamingResponse(
            file_stream,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers=headers
        )

    except Exception as e:
        logger.error(f"Error in export_word: {str(e)}")
        return JSONResponse(
            content={"message": f"Server error: {str(e)}", "success": False},
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

# -----------------------------------------------------------------
#  Helper – generate the Excel file (used by both endpoints)
# -----------------------------------------------------------------
async def generate_excel_bytes(emp_id: str, audit_data: dict) -> bytes:
    """Return the Excel workbook as bytes."""
    today = datetime.now(timezone.utc).date().isoformat()
    wb = Workbook()
    wb.remove(wb.active)          # drop default sheet

    sections = audit_data.get("sections", {})

    # ---------- Helper for column widths ----------
    def adjust(ws, widths):
        for col, w in enumerate(widths, start=1):
            ws.column_dimensions[get_column_letter(col)].width = w
        for row in ws.iter_rows(min_row=2):
            for cell in row:
                cell.alignment = Alignment(wrap_text=True, vertical="top")

    # ---------- General Report ----------
    ws = wb.create_sheet("General Report")
    ws.append(["Field", "Value"])
    gr = sections.get("general_report", {})
    if gr:
        for k, v in gr.items():
            ws.append([k.replace("_", " ").title(), str(v)])
    else:
        ws.append(["No general report saved.", ""])
    adjust(ws, [40, 20])

    # ---------- Stock Reconciliation ----------
    ws = wb.create_sheet("Stock Reconciliation")
    ws.append([
        "Commodity", "Stock Type", "Quantity as per Registered",
        "Physical", "Difference", "Remarks"
    ])
    stock = sections.get("stock_reconciliation", {}).get("commodities", [])
    if stock:
        for item in stock:
            ws.append([
                item.get("commodity", ""),
                item.get("commodity", ""),          # stock type = commodity field
                item.get("qty_registered", ""),
                item.get("qty_physical", ""),
                item.get("difference", ""),
                item.get("remarks", "")
            ])
    else:
        ws.append(["No stock data.", "", "", "", "", ""])
    adjust(ws, [20, 20, 20, 20, 20, 30])
    
    # ========== ADD THIS: Stock Commodity Sheet ==========
    ws = wb.create_sheet("Stock Commodity")
    ws.append([
        "Item Code", "Item Name", "Book Qty", "Physical Qty", "Difference", "Remarks"
    ])
    stock_commodity = sections.get("stock_commodity", {}).get("items", [])
    if stock_commodity:
        for item in stock_commodity:
            ws.append([
                item.get("item_code", ""),
                item.get("item_name", ""),
                item.get("book_qty", ""),
                item.get("physical_qty", ""),
                item.get("difference", ""),
                item.get("remarks", "")
            ])
    else:
        ws.append(["No stock commodity data.", "", "", "", "", ""])
    adjust(ws, [20, 25, 15, 15, 15, 30])
    # ========== END OF STOCK COMMODITY ADDITION ==========

    # ---------- Question-based sections ----------
    q_sections = [
        ("observations_on_stacking", "Observations on Stacking"),
        ("observations_on_warehouse_operations", "Observations on Warehouse Operations"),
        ("observations_on_warehouse_record_keeping", "Observations on Warehouse Record Keeping"),
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
                ws.append([
                    f"{idx}. {q.get('question', f'Question {idx}').strip()}",
                    q.get("answer", "").strip(),
                    q.get("remarks", "").strip()
                ])
        else:
            ws.append(["No data saved.", "", ""])
        adjust(ws, [60, 10, 30])

    # ---------- Signature ----------
    ws = wb.create_sheet("Signature")
    sig = sections.get("signature", {}).get("signature")
    if sig:
        try:
            img_data = re.sub("^data:image/.+;base64,", "", sig)
            img_bytes = io.BytesIO(base64.b64decode(img_data))
            img = Image(img_bytes)
            img.width = 250
            img.height = 150
            ws.add_image(img, "A1")
            ws["A3"] = "Signature captured during the audit"
        except Exception as e:
            ws["A1"] = f"Unable to embed signature: {e}"
    else:
        ws["A1"] = "Signature not found."
    ws.column_dimensions["A"].width = 60

    # ---------- Photo ----------
    ws = wb.create_sheet("Photo")
    photo = sections.get("photo", {}).get("photo")
    maps_url = sections.get("photo", {}).get("maps_url")
    row = 1
    if maps_url:
        ws["A1"] = "Maps URL"
        ws["B1"] = maps_url
        row += 2
    if photo:
        try:
            img_data = re.sub("^data:image/.+;base64,", "", photo)
            img_bytes = io.BytesIO(base64.b64decode(img_data))
            img = Image(img_bytes)
            img.width = 350
            img.height = 250
            ws.add_image(img, f"A{row}")
            ws[f"A{row + 20}"] = "Photo captured during the audit"
        except Exception as e:
            ws[f"A{row}"] = f"Unable to embed photo: {e}"
    else:
        ws[f"A{row}"] = "Photo not found."
    ws.column_dimensions["A"].width = 60
    ws.column_dimensions["B"].width = 40

    # ---------- Write to bytes ----------
    out = io.BytesIO()
    wb.save(out)
    out.seek(0)
    return out.read()


# -----------------------------------------------------------------
#  SEND EMAIL – attach uploaded PDF + generated Excel
# -----------------------------------------------------------------
@app.post("/api/send-email")
async def send_email(
    to_email: str = Form(...),
    attachment: UploadFile = File(...),          # mandatory PDF
    emp_id: str = Depends(get_current_user)
):
    """
    Send the user-uploaded PDF **and** a freshly generated Excel file.
    From: MAIL_USERNAME   To: to_email   CC: emp_id (user's e-mail)
    """
    try:
        today = datetime.now(timezone.utc).date().isoformat()
        logger.info(f"Email request → {to_email} (CC {emp_id}) by {emp_id}")

        # ---- 1. Validate uploaded file is PDF ----
        if not attachment.filename.lower().endswith(".pdf"):
            return JSONResponse(
                {"message": "Only PDF files are allowed", "success": False},
                status_code=400,
            )
        pdf_bytes = await attachment.read()
        pdf_name = attachment.filename

        # ---- 2. Fetch audit data & generate Excel ----
        audit_data = audit_data_collection.find_one(
            {"user_id": emp_id, "date": today}
        )
        if not audit_data:
            return JSONResponse(
                {"message": "No audit data for today", "success": False},
                status_code=404,
            )

        # (optional) you may still enforce completion here – keep the same check as export
        completion = audit_data.get("completion_status", {})
        expected = [
            "general_report", "stock_reconciliation", "stock_commodity",
            "observations_on_stacking", "observations_on_warehouse_operations",
            "observations_on_warehouse_record_keeping", "observations_on_wh_infrastructure",
            "observations_on_quality_operation",
            "checklist_wrt_exchange_circular_mentha_oil",
            "checklist_wrt_exchange_circular_metal",
            "checklist_wrt_exchange_circular_cotton_bales",
            "signature", "photo"
        ]
        if not all(completion.get(s, False) for s in expected):
            return JSONResponse(
                {"message": "Complete all sections before sending e-mail", "success": False},
                status_code=400,
            )

        excel_bytes = await generate_excel_bytes(emp_id, audit_data)
        excel_name = f"audit_{emp_id}_{today}.xlsx"

        # ---- 3. Build e-mail message ----
        msg = EmailMessage()
        msg["Subject"] = f"Audit Report – {today}"
        msg["From"] = os.getenv("MAIL_USERNAME")
        msg["To"] = to_email
        msg["Cc"] = emp_id
        msg.set_content(
            f"""Dear Auditor Manager,

Please find attached:
1. The PDF you uploaded ({pdf_name})
2. The audit data in Excel format ({excel_name})

Regards,
Audit App (via Gmail SMTP)
"""
        )

        # PDF attachment
        msg.add_attachment(
            pdf_bytes,
            maintype="application",
            subtype="pdf",
            filename=pdf_name,
        )

        # Excel attachment
        msg.add_attachment(
            excel_bytes,
            maintype="application",
            subtype="vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=excel_name,
        )

        # ---- 4. Send via Gmail SMTP ----
        smtp_server = "smtp.gmail.com"
        smtp_port = 587
        smtp_user = os.getenv("MAIL_USERNAME")
        smtp_pass = os.getenv("MAIL_PASSWORD")

        logger.info(f"Connecting to SMTP as {smtp_user}")
        with smtplib.SMTP(smtp_server, smtp_port) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.login(smtp_user, smtp_pass)
            smtp.send_message(msg)

        logger.info("Email sent successfully")
        return JSONResponse(
            {"message": "Email sent successfully", "success": True},
            status_code=200,
        )

    except Exception as e:
        logger.error(f"Send-email error: {e}")
        return JSONResponse(
            {"message": f"Failed to send email: {str(e)}", "success": False},
            status_code=500,
        )


# -----------------------------------------------------------------
#  EXPORT EXCEL – unchanged (download only the Excel file)
# -----------------------------------------------------------------
@app.get("/api/export-excel")
async def export_excel(emp_id: str = Depends(get_current_user)):
    """Download the audit data as an Excel file."""
    try:
        today = datetime.now(timezone.utc).date().isoformat()
        logger.info(f"Export-Excel request by {emp_id}")

        audit_data = temp_audit_data_collection.find_one(
            {"user_id": emp_id, "date": today}
        )
        if not audit_data:
            return JSONResponse(
                {"message": "No audit data for today", "success": False},
                status_code=404,
            )

        # Completion check (same as before)
        completion = audit_data.get("completion_status", {})
        expected = [
            "general_report", "stock_reconciliation", "stock_commodity",
            "observations_on_stacking", "observations_on_warehouse_operations",
            "observations_on_warehouse_record_keeping", "observations_on_wh_infrastructure",
            "observations_on_quality_operation",
            "checklist_wrt_exchange_circular_mentha_oil",
            "checklist_wrt_exchange_circular_metal",
            "checklist_wrt_exchange_circular_cotton_bales",
            "signature", "photo"
        ]
        if not all(completion.get(s, False) for s in expected):
            return JSONResponse(
                {"message": "Complete all sections before exporting", "success": False},
                status_code=400,
            )

        excel_bytes = await generate_excel_bytes(emp_id, audit_data)
        filename = f"audit_{emp_id}_{today}.xlsx"
        headers = {
            "Content-Disposition": f'attachment; filename*=UTF-8\'\'{filename}'
        }

        return StreamingResponse(
            io.BytesIO(excel_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers=headers,
        )

    except Exception as e:
        logger.error(f"Export-excel error: {e}")
        return JSONResponse(
            {"message": f"Server error: {str(e)}", "success": False},
            status_code=500,
        )
        
def get_token(request: Request) -> str:
    token = request.cookies.get("access_token")
    if token:
        return token
    auth = request.headers.get("Authorization")
    if auth and auth.startswith("Bearer "):
        return auth.split(" ")[1]
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")

# Static HTML Endpoints
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
