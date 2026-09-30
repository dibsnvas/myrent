"""Upload rules: check what a file really is, cap its size, strip photo metadata, hand out signed links."""
from __future__ import annotations

import io
from dataclasses import dataclass
from datetime import date, datetime

from PIL import ExifTags, Image, ImageOps, UnidentifiedImageError

from rest_framework.exceptions import ValidationError

from django.core import signing
from django.core.files.base import ContentFile, File
from django.core.files.uploadedfile import UploadedFile
from django.http import Http404, HttpRequest
from django.urls import reverse

from apps.rentals.constants import (
    FILE_LINK_MAX_AGE_SECONDS,
    FILE_LINK_SALT,
    IMAGE_FORMATS,
    JPEG_QUALITY,
    PDF_CONTENT_TYPE,
    PDF_SIGNATURE,
    UPLOAD_MAX_IMAGE_BYTES,
    UPLOAD_MAX_PDF_BYTES,
)
from apps.rentals.models import Document

WRONG_TYPE_MESSAGE = 'Only PDF, JPG, PNG or WEBP files are allowed. iPhone photos: choose "Most compatible" (JPG).'


@dataclass(frozen=True)
class PreparedUpload:
    content: File
    content_type: str
    extension: str
    size: int
    taken_on: date | None


def _megabytes(size: int) -> int:
    return size // (1024 * 1024)


def _photo_date(image: Image.Image) -> date | None:
    """Best effort: the camera's 'date taken', used to pre-fill condition photo dates."""
    exif = image.getexif()
    raw = exif.get_ifd(ExifTags.IFD.Exif).get(ExifTags.Base.DateTimeOriginal) or exif.get(ExifTags.Base.DateTime)
    if not isinstance(raw, str):
        return None
    try:
        return datetime.strptime(raw[:10], '%Y:%m:%d').date()
    except ValueError:
        return None


def prepare_upload(upload: UploadedFile) -> PreparedUpload:
    """Validate by content (not by extension) and return what should actually be stored."""
    head = upload.read(len(PDF_SIGNATURE))
    upload.seek(0)
    if head == PDF_SIGNATURE:
        if upload.size > UPLOAD_MAX_PDF_BYTES:
            raise ValidationError({'file': f'PDF files must be {_megabytes(UPLOAD_MAX_PDF_BYTES)} MB or smaller.'})
        return PreparedUpload(upload, PDF_CONTENT_TYPE, '.pdf', upload.size, None)

    if upload.size > UPLOAD_MAX_IMAGE_BYTES:
        raise ValidationError({'file': f'Images must be {_megabytes(UPLOAD_MAX_IMAGE_BYTES)} MB or smaller.'})
    try:
        with Image.open(upload) as probe:
            probe.verify()
        upload.seek(0)
        with Image.open(upload) as image:
            image_format = image.format
            if image_format not in IMAGE_FORMATS:
                raise ValidationError({'file': WRONG_TYPE_MESSAGE})
            taken_on = _photo_date(image)
            # Apply the EXIF rotation to the pixels first, then save without EXIF/XMP:
            # this drops GPS location and camera details but keeps the photo the right way up.
            clean = ImageOps.exif_transpose(image)
            icc_profile = image.info.get('icc_profile')
        clean.info = {'icc_profile': icc_profile} if icc_profile else {}
        if image_format == 'JPEG' and clean.mode not in ('RGB', 'L', 'CMYK'):
            clean = clean.convert('RGB')
        buffer = io.BytesIO()
        save_options = {'quality': JPEG_QUALITY} if image_format in ('JPEG', 'WEBP') else {}
        clean.save(buffer, format=image_format, exif=b'', **save_options)
    except (UnidentifiedImageError, OSError, SyntaxError, Image.DecompressionBombError) as exc:
        raise ValidationError({'file': WRONG_TYPE_MESSAGE}) from exc
    upload.seek(0)

    content_type, extension = IMAGE_FORMATS[image_format]
    data = buffer.getvalue()
    return PreparedUpload(ContentFile(data), content_type, extension, len(data), taken_on)


def file_link(request: HttpRequest, document: Document) -> str:
    """A link that works without a login header (for <img> and new tabs) and expires in a few minutes."""
    token = signing.dumps(document.pk, salt=FILE_LINK_SALT)
    return request.build_absolute_uri(reverse('document-file', args=[token]))


def document_for_token(token: str) -> Document:
    try:
        document_id = signing.loads(token, salt=FILE_LINK_SALT, max_age=FILE_LINK_MAX_AGE_SECONDS)
    except signing.BadSignature as exc:  # also covers SignatureExpired
        raise Http404('Link expired or invalid') from exc
    try:
        return Document.objects.get(pk=document_id)
    except Document.DoesNotExist as exc:
        raise Http404('File not found') from exc
