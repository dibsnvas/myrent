TITLE_MAX_LENGTH = 100
ADDRESS_MAX_LENGTH = 255
PERSON_NAME_MAX_LENGTH = 150
PHONE_MAX_LENGTH = 30
SHORT_NAME_MAX_LENGTH = 50
UNIT_MAX_LENGTH = 20
CHOICE_MAX_LENGTH = 20

MONEY_MAX_DIGITS = 12
MONEY_DECIMAL_PLACES = 2
READING_MAX_DIGITS = 12
READING_DECIMAL_PLACES = 3

# Day-of-month fields stop at 28 so every month has that day.
DAY_OF_MONTH_MIN = 1
DAY_OF_MONTH_MAX = 28

MAX_CONTRACT_MONTHS = 60

# Reminders: how far ahead "due soon" looks, and when a lease end starts to show.
REMINDER_DAYS_AHEAD = 3
CONTRACT_END_WARNING_DAYS = 30

# Uploads
UPLOAD_MAX_PDF_BYTES = 10 * 1024 * 1024
UPLOAD_MAX_IMAGE_BYTES = 5 * 1024 * 1024
PDF_CONTENT_TYPE = 'application/pdf'
PDF_SIGNATURE = b'%PDF-'
# Pillow format name -> (content type, file extension)
IMAGE_FORMATS = {
    'JPEG': ('image/jpeg', '.jpg'),
    'PNG': ('image/png', '.png'),
    'WEBP': ('image/webp', '.webp'),
}
JPEG_QUALITY = 90

# Signed file links
FILE_LINK_SALT = 'rentals.document-file'
FILE_LINK_MAX_AGE_SECONDS = 600
