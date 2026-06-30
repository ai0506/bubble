// Detect and split an Android "Motion Photo" / vendor "Live Photo".
//
// Across Google Pixel, Samsung, Xiaomi, OPPO/OnePlus/realme and vivo the
// on-disk layout is the same: a complete primary JPEG followed by a complete
// MP4 (or QuickTime/MOV) video container appended directly after it. The still
// image and the motion video can therefore both be recovered by slicing the
// byte stream at the start of the trailing video container — no transcoding
// and no native libraries required.
//
// Vendors differ only in the XMP metadata they write to advertise the video:
//   - Google / Samsung / OPPO: Container `Item:Length` of the video item
//   - Xiaomi:                  `MicroVideoOffset`
//   - OPPO (Oplus):            `VideoLength`
// All of these encode "number of trailing bytes that are video, counted from
// the end of the file". We use that as an exact hint, then validate (and, if
// absent, locate) the real boundary by finding the MP4 `ftyp` box signature.

export type MotionParts = { still: Uint8Array; video: Uint8Array };

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

// Markers that identify the file as a motion/live photo from any major vendor.
const MOTION_MARKER =
  /MotionPhoto|MicroVideo|OLivePhoto|MotionPhotoOwner|EmbeddedVideo|MotionPhoto_Data|video\/mp4|video\/quicktime/i;

// The trailing-video byte length advertised in the primary image XMP, if any.
function readXmpVideoLength(text: string): number {
  const numbers: number[] = [];
  const collect = (pattern: RegExp) => {
    const re = new RegExp(pattern, "g");
    let match: RegExpExecArray | null;
    while ((match = re.exec(text))) {
      const value = Number(match[1]);
      if (Number.isFinite(value) && value > 0) numbers.push(value);
    }
  };

  // Attribute form (Google/Samsung/OPPO Container) and element form.
  collect(/Item:Length="(\d+)"/);
  collect(/Item:Length>(\d+)</);
  // Xiaomi Micro Video and OPPO Oplus length.
  collect(/MicroVideoOffset="(\d+)"/);
  collect(/VideoLength="(\d+)"/);

  // The appended video is the largest secondary item, so its length is the max.
  return numbers.length ? Math.max(...numbers) : 0;
}

// Locate the start of the trailing MP4/MOV container by its `ftyp` box.
// `hint` is the byte offset suggested by XMP (may be -1 when unknown).
function findVideoStart(bytes: Uint8Array, hint: number): number {
  const isFtypAt = (i: number) =>
    bytes[i] === 0x66 && bytes[i + 1] === 0x74 && bytes[i + 2] === 0x79 && bytes[i + 3] === 0x70; // "ftyp"

  const isPlausibleBox = (boxStart: number) => {
    if (boxStart < 0 || boxStart + 8 > bytes.length) return false;
    const size =
      ((bytes[boxStart] << 24) |
        (bytes[boxStart + 1] << 16) |
        (bytes[boxStart + 2] << 8) |
        bytes[boxStart + 3]) >>> 0;
    return size >= 8 && size <= 4096; // an ftyp box is tiny (typically 16-32 bytes)
  };

  // Trust the XMP hint when it lands exactly on a valid ftyp box.
  if (hint > 0 && hint + 8 <= bytes.length && isFtypAt(hint + 4) && isPlausibleBox(hint)) {
    return hint;
  }

  // Otherwise scan the stream for the first plausible ftyp box header.
  for (let i = 4; i + 4 <= bytes.length; i += 1) {
    if (isFtypAt(i) && isPlausibleBox(i - 4)) return i - 4;
  }
  return -1;
}

// Returns the split still image + motion video, or null if this is a plain image.
export function extractMotionPhoto(bytes: Uint8Array): MotionParts | null {
  if (!isJpeg(bytes)) return null;

  // The XMP packet lives in an APP1 segment near the start of the JPEG.
  const headLength = Math.min(bytes.length, 512 * 1024);
  const head = Buffer.from(bytes.buffer, bytes.byteOffset, headLength).toString("latin1");
  if (!MOTION_MARKER.test(head)) return null;

  const videoLength = readXmpVideoLength(head);
  const hint = videoLength > 0 ? bytes.length - videoLength : -1;

  const start = findVideoStart(bytes, hint);
  if (start <= 0) return null;

  const still = bytes.subarray(0, start);
  const video = bytes.subarray(start);
  if (!isJpeg(still) || video.length < 1024) return null;

  return { still, video };
}
