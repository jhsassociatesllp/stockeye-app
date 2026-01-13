from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer
import jwt
import os
from dotenv import load_dotenv
from datetime import datetime, timezone, timedelta

load_dotenv()


security = HTTPBearer()
print("JWT_SECRET:", os.getenv("JWT_SECRET"))

def create_jwt(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(seconds=int(os.getenv("JWT_EXP_SECONDS", 86400)))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, os.getenv("JWT_SECRET"), algorithm=os.getenv("JWT_ALGORITHM"))
    return encoded_jwt

async def get_current_user(token: str = Depends(security)):
    try:
        print("Decoding JWT token", token)
        payload = jwt.decode(token.credentials, os.getenv("JWT_SECRET"), algorithms=[os.getenv("JWT_ALGORITHM", "HS256")])
        emp_id: str = payload.get("sub")
        print(emp_id)
        if emp_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return emp_id
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {str(e)}")