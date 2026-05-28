import pandas as pd
from typing import Any, Dict

def perform_eda(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Performs basic EDA on the given dataframe.
    """
    # Basic info
    rows, cols = df.shape
    
    # Missing values per column
    missing_values = df.isnull().sum().to_dict()
    
    # Total duplicates
    duplicates = int(df.duplicated().sum())
    
    # Column names and their data types
    columns_info = {col: str(dtype) for col, dtype in df.dtypes.items()}
    
    # Preview (first 5 rows)
    # We replace NaN with None for JSON compatibility
    preview = df.head(5).where(pd.notnull(df), None).to_dict(orient="records")
    
    return {
        "rows": rows,
        "columns": cols,
        "column_names": list(df.columns),
        "column_types": columns_info,
        "missing_values": missing_values,
        "duplicates": duplicates,
        "preview": preview
    }
