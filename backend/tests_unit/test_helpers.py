

def test_llm_image_media_type_from_signature():
    import base64
    import llm
    png = base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"\x00" * 16).decode()
    jpg = base64.b64encode(b"\xff\xd8\xff\xe0" + b"\x00" * 16).decode()
    webp = base64.b64encode(b"RIFF\x00\x00\x00\x00WEBPVP8 " + b"\x00" * 8).decode()
    assert llm.image_media_type(png) == "image/png"
    assert llm.image_media_type(jpg) == "image/jpeg"
    assert llm.image_media_type(webp) == "image/webp"
    assert llm.available() in (True, False)
