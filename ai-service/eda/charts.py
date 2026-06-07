import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import json
from typing import Dict, Any

def generate_eda_charts(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Generates a set of Plotly charts for the given dataframe.
    Optimized for large datasets by sampling.
    """
    # 1. Optimization: Sample if the dataset is too large (> 10,000 rows)
    if len(df) > 10000:
        plot_df = df.sample(n=10000, random_state=42)
    else:
        plot_df = df

    charts = {}

    # Identify column types
    numeric_cols = plot_df.select_dtypes(include=['number']).columns.tolist()
    categorical_cols = plot_df.select_dtypes(include=['object', 'category']).columns.tolist()
    datetime_cols = plot_df.select_dtypes(include=['datetime64', 'datetime']).columns.tolist()

    # --- 1. Histograms (Distribution Analysis) ---
    if numeric_cols:
        for i, col in enumerate(numeric_cols[:3]):  # First 3 numeric columns
            fig_hist = px.histogram(
                plot_df, x=col,
                title=f"Distribution Analysis: {col}",
                template="plotly_white",
                color_discrete_sequence=['#f06500']
            )
            charts[f"histogram_{i}"] = json.loads(fig_hist.to_json())

    # --- 2. Box Plots (Outlier Detection) ---
    if numeric_cols:
        for i, col in enumerate(numeric_cols[:3]):
            fig_box = px.box(
                plot_df, y=col,
                title=f"Outlier Detection: {col}",
                template="plotly_white",
                color_discrete_sequence=['#1a6aff']
            )
            charts[f"boxplot_{i}"] = json.loads(fig_box.to_json())

    # --- 3. Correlation Heatmap ---
    if len(numeric_cols) > 1:
        corr_matrix = plot_df[numeric_cols].corr()
        fig_heat = px.imshow(
            corr_matrix,
            text_auto=True,
            title="Correlation Heatmap",
            template="plotly_white",
            color_continuous_scale='RdBu_r'
        )
        charts["correlation"] = json.loads(fig_heat.to_json())

    # --- 4. Line Charts (Trend Analysis) ---
    if numeric_cols:
        for i, col in enumerate(numeric_cols[:2]):
            fig_line = px.line(
                plot_df, y=col,
                title=f"Trend Analysis: {col} (First 100 rows)",
                template="plotly_white",
                color_discrete_sequence=['#8b5cf6']
            )
            charts[f"linechart_{i}"] = json.loads(fig_line.to_json())

    # --- 5. Bar Charts (Frequency Analysis for Categorical Data) ---
    if categorical_cols:
        for i, col in enumerate(categorical_cols[:2]):
            # Get top 10 categories to avoid clutter
            top_cats = plot_df[col].value_counts().head(10).index
            filtered_df = plot_df[plot_df[col].isin(top_cats)]
            fig_bar = px.bar(
                filtered_df, x=col,
                title=f"Frequency Analysis: {col} (Top 10)",
                template="plotly_white",
                color_discrete_sequence=['#10b981']
            )
            charts[f"barchart_{i}"] = json.loads(fig_bar.to_json())

    # --- 6. Pie Charts (Percentage Distribution) ---
    if categorical_cols:
        for i, col in enumerate(categorical_cols[:1]):
            top_cats = plot_df[col].value_counts().head(10).index
            filtered_df = plot_df[plot_df[col].isin(top_cats)]
            fig_pie = px.pie(
                filtered_df, names=col,
                title=f"Percentage Distribution: {col}",
                template="plotly_white"
            )
            charts[f"piechart_{i}"] = json.loads(fig_pie.to_json())

    # --- 7. Violin Plots / Box Plots (Categorical + Numerical Comparison) ---
    if numeric_cols and categorical_cols:
        num_col = numeric_cols[0]
        cat_col = categorical_cols[0]
        top_cats = plot_df[cat_col].value_counts().head(5).index
        filtered_df = plot_df[plot_df[cat_col].isin(top_cats)]
        
        # Violin Plot
        fig_violin = px.violin(
            filtered_df, x=cat_col, y=num_col,
            title=f"Comparison: {num_col} by {cat_col}",
            template="plotly_white",
            color_discrete_sequence=['#f59e0b']
        )
        charts["violin_comparison"] = json.loads(fig_violin.to_json())

    # --- 8. Time Series (DateTime Trends) ---
    if datetime_cols and numeric_cols:
        dt_col = datetime_cols[0]
        num_col = numeric_cols[0]
        fig_time = px.line(
            plot_df, x=dt_col, y=num_col,
            title=f"Time Trend: {num_col} over {dt_col}",
            template="plotly_white",
            color_discrete_sequence=['#06b6d4']
        )
        charts["timeseries"] = json.loads(fig_time.to_json())

    # --- 9. Missing Value Chart (Keep Existing) ---
    missing_data = df.isnull().sum()
    if missing_data.sum() > 0:
        missing_df = missing_data[missing_data > 0].reset_index()
        missing_df.columns = ['Column', 'Missing Count']
        fig_missing = px.bar(
            missing_df, x='Column', y='Missing Count',
            title="Data Warning: Missing Values",
            template="plotly_white",
            color_discrete_sequence=['#ef4444']
        )
        charts["missing_values"] = json.loads(fig_missing.to_json())
    else:
        charts["missing_values"] = None

    return charts
