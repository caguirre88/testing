import re
from datetime import datetime
import pandas as pd


def extract_phone_numbers_from_textfile(
        text_filename: str,
        phone_regex: str = r'''
        (\+?1[\s\-\.])?          # Optional country code
        (\(?\d{3}\)?[\s\-\.])?   # Optional area code
        \d{3}[\s\-\.]\d{4}       # Main number
    '''
) -> pd.DataFrame:
    """Extract phone numbers from a text file."""
    phone_pattern = re.compile(phone_regex, re.VERBOSE)
    phone_numbers = []
    current_permit_number = ''
    current_link = ''
    current_text = ''

    with open(text_filename, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    for line in lines:
        line_stripped = line.strip()
        if line_stripped.startswith('Permit Number:'):
            if current_text:
                matches = phone_pattern.findall(current_text)
                for match in matches:
                    phone = ''.join(match).strip()
                    phone_numbers.append({
                        'Permit Number': current_permit_number,
                        'Link': current_link,
                        'Phone Number': phone
                    })
                current_text = ''
            current_permit_number = line_stripped.replace('Permit Number:', '').strip()
        elif line_stripped.startswith('Link:'):
            current_link = line_stripped.replace('Link:', '').strip()
        else:
            current_text += ' ' + line_stripped

    if current_text:
        matches = phone_pattern.findall(current_text)
        for match in matches:
            phone = ''.join(match).strip()
            phone_numbers.append({
                'Permit Number': current_permit_number,
                'Link': current_link,
                'Phone Number': phone
            })

    return pd.DataFrame(phone_numbers)
