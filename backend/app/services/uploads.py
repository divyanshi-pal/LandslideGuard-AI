"""Validate and store citizen media uploads.

Photos are decoded with Pillow and re-encoded, which rejects non-images and strips all
metadata (including EXIF GPS tags that could identify the reporter). The camera timestamp
is read first and kept as metadata for verification.

Videos are validated by their container signature (MP4/MOV/3GP "ftyp" box, WebM EBML header),
never by the client-declared type. They are NOT re-encoded (no transcoder is available), so
any embedded metadata (some phones store GPS in MP4 files) remains. For that reason videos
are only ever served to administrators through signed links - see app/routers/media.py.
"""

from __future__ import annotations

import hashlib
import io
import uuid
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

ALLOWED_FORMATS = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}
MAX_DIMENSION = 2048
Image.MAX_IMAGE_PIXELS = 30_000_000  # Pillow raises above 2x this (decompression bombs)

EXIF_IFD = 0x8769
EXIF_DATETIME_ORIGINAL = 0x9003
EXIF_DATETIME = 0x0132

MP4_BRANDS = {b"isom", b"iso2", b"iso4", b"iso5", b"iso6", b"mp41", b"mp42", b"avc1", b"M4V ", b"mmp4", b"MSNV", b"dash"}
GPP_BRANDS = {b"3gp4", b"3gp5", b"3gp6", b"3g2a"}


class MediaError(ValueError):
    pass


PhotoError = MediaError  # backwards-compatible name


@dataclass(frozen=True)
class PhotoInfo:
    filename: str
    content_type: str
    size_bytes: int
    width: int
    height: int
    sha256: str
    exif_datetime: str | None


@dataclass(frozen=True)
class VideoInfo:
    filename: str
    content_type: str
    size_bytes: int
    sha256: str


def _limit_mb(max_bytes: int) -> str:
    return f"{max_bytes / (1024 * 1024):g} MB"


def _exif_datetime(img: Image.Image) -> str | None:
    try:
        exif = img.getexif()
        value = exif.get_ifd(EXIF_IFD).get(EXIF_DATETIME_ORIGINAL) or exif.get(EXIF_DATETIME)
    except Exception:
        return None
    return str(value).strip()[:32] if value else None


def save_photo(data: bytes, upload_dir: Path, max_bytes: int) -> PhotoInfo:
    if not data:
        raise MediaError("Uploaded photo is empty")
    if len(data) > max_bytes:
        raise MediaError(f"Photo exceeds the {_limit_mb(max_bytes)} limit")

    try:
        with Image.open(io.BytesIO(data)) as probe:
            fmt = probe.format
            probe.verify()  # must be the first call after open
        img = Image.open(io.BytesIO(data))
        exif_dt = _exif_datetime(img)
        img.load()
    except (UnidentifiedImageError, OSError, SyntaxError, Image.DecompressionBombError) as exc:
        raise MediaError("File is not a valid image") from exc

    if fmt not in ALLOWED_FORMATS:
        raise MediaError(f"Unsupported image format {fmt}; use JPEG, PNG or WebP")

    img = ImageOps.exif_transpose(img)  # keep the visible orientation before dropping EXIF
    img.thumbnail((MAX_DIMENSION, MAX_DIMENSION))

    upload_dir.mkdir(parents=True, exist_ok=True)
    if img.mode in ("RGBA", "LA", "P") and fmt == "PNG":
        name, content_type = f"{uuid.uuid4().hex}.png", "image/png"
        img.save(upload_dir / name, format="PNG", optimize=True)
    else:
        name, content_type = f"{uuid.uuid4().hex}.jpg", "image/jpeg"
        img.convert("RGB").save(upload_dir / name, format="JPEG", quality=85)
    return PhotoInfo(
        filename=name,
        content_type=content_type,
        size_bytes=(upload_dir / name).stat().st_size,
        width=img.width,
        height=img.height,
        sha256=hashlib.sha256(data).hexdigest(),
        exif_datetime=exif_dt,
    )


def detect_video_type(head: bytes) -> tuple[str, str] | None:
    """Return (content_type, extension) from the file signature, or None if not a supported video."""
    if len(head) >= 12 and head[4:8] == b"ftyp":
        brand = head[8:12]
        if brand == b"qt  ":
            return "video/quicktime", ".mov"
        if brand in MP4_BRANDS:
            return "video/mp4", ".mp4"
        if brand in GPP_BRANDS:
            return "video/3gpp", ".3gp"
        return None
    if head[:4] == b"\x1a\x45\xdf\xa3" and b"webm" in head[:64]:
        return "video/webm", ".webm"
    return None


def save_video(data: bytes, upload_dir: Path, max_bytes: int) -> VideoInfo:
    if not data:
        raise MediaError("Uploaded video is empty")
    if len(data) > max_bytes:
        raise MediaError(f"Video exceeds the {_limit_mb(max_bytes)} limit")
    detected = detect_video_type(data[:64])
    if detected is None:
        raise MediaError("File is not a supported video; use MP4, MOV, 3GP or WebM")
    content_type, ext = detected
    upload_dir.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}{ext}"
    (upload_dir / name).write_bytes(data)
    return VideoInfo(name, content_type, len(data), hashlib.sha256(data).hexdigest())


def media_path(upload_dir: Path, name: str | None) -> Path | None:
    """Resolve a stored media file, refusing anything outside the upload directory."""
    if not name:
        return None
    path = (upload_dir / name).resolve()
    if path.parent != upload_dir.resolve() or not path.is_file():
        return None
    return path


def delete_media(upload_dir: Path, name: str | None) -> None:
    path = media_path(upload_dir, name)
    if path is not None:
        path.unlink()


delete_photo = delete_media  # backwards-compatible name
