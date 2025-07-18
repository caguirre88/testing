from datetime import datetime
import pandas as pd

from .fetcher import fetch_and_filter_data, add_hyperlinks
from .exporter import export_filtered_data, export_text_data_selenium
from .phone_extractor import extract_phone_numbers_from_textfile


def main():
    df_filtered = fetch_and_filter_data(
        dataset_id="i26v-w6bd",
        min_valuation=100000,
        days_back=60,
        drop_columns_by_index=[8, 10]
    )

    base_url = (
        "https://permittingservices.montgomerycountymd.gov/"
        "DPS/online/eSearchResultH8.aspx?t=Details&o=TypeAPNo&a=1036&b="
    )
    df_filtered = add_hyperlinks(df_filtered, base_url)

    export_filtered_data(df_filtered, filename_prefix="MoCodata")

    my_proxy = None
    text_file_path = export_text_data_selenium(df_filtered, filename_prefix="MoCodata", proxy=my_proxy)

    phone_numbers_df = extract_phone_numbers_from_textfile(text_file_path)
    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    phone_numbers_filename = f'PhoneNumbers_{timestamp_str}.csv'
    phone_numbers_df.to_csv(phone_numbers_filename, index=False)
    print(f'Phone numbers extracted to {phone_numbers_filename}')


if __name__ == "__main__":
    main()
