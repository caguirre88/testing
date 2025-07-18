import pandas as pd
from sodapy import Socrata
from datetime import datetime, timedelta


def fetch_and_filter_data(
        domain: str = "data.montgomerycountymd.gov",
        dataset_id: str = "i26v-w6bd",
        min_valuation: float = 100000,
        days_back: int = 60,
        drop_columns_by_index: list = [8, 10],
) -> pd.DataFrame:
    """Fetch and filter permit data from a Socrata dataset."""
    client = Socrata(domain, None)
    all_results = client.get_all(dataset_id)
    df = pd.DataFrame.from_records(all_results)

    df['issueddate'] = pd.to_datetime(df['issueddate'], errors='coerce')
    df['declaredvaluation'] = pd.to_numeric(df['declaredvaluation'], errors='coerce')
    df = df[df['declaredvaluation'] > min_valuation]
    earliest_date = datetime.now() - timedelta(days=days_back)
    df = df[df['issueddate'] >= earliest_date]
    df = df.sort_values(by='issueddate', ascending=False)

    valid_drop_cols = []
    for idx in drop_columns_by_index:
        if idx < len(df.columns):
            valid_drop_cols.append(df.columns[idx])

    if valid_drop_cols:
        df.drop(columns=valid_drop_cols, inplace=True)

    df['declaredvaluation'] = df['declaredvaluation'].map('${:,.2f}'.format)
    return df


def add_hyperlinks(df: pd.DataFrame, base_url: str) -> pd.DataFrame:
    """Add a hyperlink column to the dataframe."""
    first_col = df.columns[0]
    df['hyperlink'] = df[first_col].astype(str).apply(lambda x: f"{base_url}{x}")
    return df
