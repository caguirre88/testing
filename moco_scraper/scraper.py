import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import WebDriverException


def get_selenium_driver(proxy=None):
    """Return a headless Chrome WebDriver, optionally using a proxy."""
    chrome_options = Options()
    chrome_options.headless = True
    chrome_options.add_argument('--disable-gpu')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument(
        "user-agent=Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/44.0.2403.157 Safari/537.36"
    )
    if proxy:
        chrome_options.add_argument(f'--proxy-server={proxy}')

    driver = webdriver.Chrome(options=chrome_options)
    return driver


def scrape_page_selenium(url, driver, timeout=20):
    """Load a URL using Selenium and return the HTML source."""
    try:
        driver.set_page_load_timeout(timeout)
        driver.get(url)
        time.sleep(2)
        return driver.page_source
    except WebDriverException as e:
        print(f"Error fetching {url} with Selenium: {e}")
        return None
