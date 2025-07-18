from datetime import datetime
from bs4 import BeautifulSoup
import pandas as pd

from .scraper import get_selenium_driver, scrape_page_selenium


def export_filtered_data(df: pd.DataFrame, filename_prefix: str = 'MoCodata'):
    """Export a dataframe to CSV with a timestamp."""
    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{filename_prefix}_{timestamp_str}.csv"
    df.to_csv(filename, index=False)
    print(f"Data exported to {filename}")


def export_text_data_selenium(df: pd.DataFrame, filename_prefix: str = 'MoCodata', proxy=None) -> str:
    """Fetch each hyperlink using Selenium and save the page text."""
    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    text_filename = f"{filename_prefix}_{timestamp_str}.txt"
    first_col = df.columns[0]
    driver = get_selenium_driver(proxy=proxy)

    with open(text_filename, 'w', encoding='utf-8') as f:
        for _, row in df.iterrows():
            link = row['hyperlink']
            permit_number = row[first_col]
            html = scrape_page_selenium(link, driver, timeout=20)
            if html:
                soup = BeautifulSoup(html, 'html.parser')
                text = soup.get_text(separator=' ', strip=True)
                f.write(f"Permit Number: {permit_number}\n")
                f.write(f"Link: {link}\n")
                f.write(text)
                f.write('\n\n')
            else:
                print(f"Failed to fetch {link} with Selenium.")

    driver.quit()
    print(f"Text data exported to {text_filename}")
    return text_filename
