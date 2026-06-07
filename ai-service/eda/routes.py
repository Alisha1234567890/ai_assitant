import pandas as pd
import io
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from .analysis import perform_eda
from .session_store import store_dataframe, get_dataframe, store_analysis, get_analysis, store_insights, get_stored_insights
from .charts import generate_eda_charts
from .insights import generate_ai_insights
from .report import generate_eda_report_html

router = APIRouter(prefix="/eda", tags=["EDA"])

@router.post("/upload")
async def upload_dataset(file: UploadFile = File(...)):
    """
    Uploads a CSV or XLSX file, performs basic EDA, and returns the results.
    """
    filename = file.filename
    content_type = file.content_type
    
    try:
        # Read the file content
        contents = await file.read()
        
        # Load into pandas based on file extension
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents))
        elif filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            raise HTTPException(
                status_code=400, 
                detail="Invalid file type. Please upload a CSV or Excel file."
            )
            
        # Generate a session ID to store the dataframe
        session_id = str(uuid.uuid4())
        store_dataframe(session_id, df)
        
        # Perform initial EDA and store it
        analysis_results = perform_eda(df)
        store_analysis(session_id, analysis_results)
        
        return {
            "session_id": session_id,
            "filename": filename,
            "analysis": analysis_results
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@router.get("/charts/{session_id}")
async def get_charts(session_id: str):
    """
    Generates Plotly charts for a previously uploaded dataset.
    """
    df = get_dataframe(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found or dataset expired.")
    
    try:
        charts = generate_eda_charts(df)
        return {
            "session_id": session_id,
            "charts": charts
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating charts: {str(e)}")

@router.post("/insights/{session_id}")
async def get_insights(session_id: str):
    """
    Generates AI-driven insights for a previously uploaded dataset.
    """
    df = get_dataframe(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found or dataset expired.")
    
    try:
        insights = await generate_ai_insights(df)
        store_insights(session_id, insights)
        return {
            "session_id": session_id,
            "insights": insights
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating AI insights: {str(e)}")

@router.get("/download-report/{session_id}")
async def download_report(session_id: str):
    """
    Downloads a complete HTML EDA report with charts and analysis.
    Uses stored AI insights if available, otherwise no AI required.
    """
    df = get_dataframe(session_id)
    analysis = get_analysis(session_id)
    insights = get_stored_insights(session_id)
    
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found or dataset expired. Please re-upload your dataset.")
    
    try:
        # If no analysis stored, generate it quickly now
        if analysis is None:
            analysis = perform_eda(df)
        
        # Generate all charts
        charts = generate_eda_charts(df)
        
        # Generate HTML report - use insights if stored, otherwise empty
        html_report = generate_eda_report_html(df, analysis or {}, charts, insights or {})
        
        # Create a streaming response
        report_bytes = io.BytesIO(html_report.encode('utf-8'))
        
        return StreamingResponse(
            report_bytes,
            media_type="text/html",
            headers={
                "Content-Disposition": f"attachment; filename=EDA_Report_{pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')}.html"
            }
        )
        
    except Exception as e:
        print(f"[EDA-Download] Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error generating report: {str(e)}")
