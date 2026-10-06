#!/usr/bin/env python3
"""Read-only, bounded acquisition of one pinned build artifact; never loads images.

CLI: --workdir PRIVATE_NEW_DIR --manifest FILE [--receipt runtime/acquisition.json]
Produces PRIVATE_NEW_DIR/backend-image.tar.gz and a synthetic image manifest.
No API response, signed URL, token, config environment, or old build log is published.
"""
import argparse
import gzip
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import sys
import tarfile
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile

REPO = "peterpeeterspeter/HOBBYSALON"
ARTIFACT = 11408703641
RUN = 37455485280
COMMIT = "a147bbc1387440f271f44e70139d62894bb27c01"
ZIP_BYTES = 275466024
ZIP_SHA = "9d121da6a625e45a8a8975bcf5cd303cfcf57d64b2c6737fd923b13e0a16cab4"
GZIP_BYTES = 273965027
GZIP_SHA = "9f3439e95cf28f8c1e456dfa6ec27dfa63d28afe7d80b46cf156d861ea5f6c36"
IMAGE = "sha256:b593554ed71091d152a73b15995818e7460e69ea41f98c16b022af52a6e521ca"
SOURCE = "b538938f0fb21f06a44fea9272e3822eddd795c7ca372c4c8c42f0d4abc7a368"
API = "https://api.github.com/repos/" + REPO
CHUNK = 1024 * 1024
JSON_LIMIT = 1024 * 1024
TAR_LIMIT = 2 * 1024**3
DEADLINE = None


class Refused(RuntimeError):
    """Only fixed, nonsecret diagnostic codes may be emitted."""


def require(ok, code):
    if not ok:
        raise Refused(code)


def budget():
    require(DEADLINE is None or time.monotonic() < DEADLINE, "acquisition-time-budget")


def safe_name(name):
    p = PurePosixPath(name)
    require(isinstance(name, str) and name and not p.is_absolute()
            and "\\" not in name and "\x00" not in name
            and all(x not in ("", ".", "..") for x in name.split("/")), "archive-path")
    return name


def json_bytes(data):
    require(len(data) <= JSON_LIMIT, "json-byte-bound")
    def unique(items):
        obj = {}
        for k, v in items:
            require(k not in obj, "duplicate-json-key")
            obj[k] = v
        return obj
    return json.loads(data, object_pairs_hook=unique,
                      parse_constant=lambda _: (_ for _ in ()).throw(Refused("json-nonfinite")))


def exclusive(path):
    return os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600), "wb")


def write_json(path, value):
    data = (json.dumps(value, indent=2, sort_keys=True) + "\n").encode()
    require(len(data) <= JSON_LIMIT, "receipt-bound")
    with exclusive(path) as f:
        f.write(data)
        f.flush()
        os.fsync(f.fileno())
    require(Path(path).read_bytes() == data, "receipt-readback")


class SafeRedirect(urllib.request.HTTPRedirectHandler):
    """Always remove authorization on redirects, including same-origin redirects."""
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        target = urllib.parse.urlsplit(newurl)
        require(target.scheme == "https" and target.hostname and not target.username
                and not target.password, "redirect-not-https")
        redirected = super().redirect_request(req, fp, code, msg, headers, newurl)
        if redirected is not None:
            for key in list(redirected.headers) + list(redirected.unredirected_hdrs):
                if key.lower() in ("authorization", "cookie", "proxy-authorization"):
                    redirected.remove_header(key)
        return redirected


def request(path, token, binary=False):
    require(path.startswith("/") and "?" not in path, "api-path")
    headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
               "User-Agent": "hobbysalon-exact-runtime-acquisition", "Accept-Encoding": "identity"}
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(API + path, headers=headers, method="GET")
    return urllib.request.build_opener(SafeRedirect()).open(req, timeout=30)


def api_json(path, token):
    budget()
    with request(path, token) as r:
        require(r.status == 200, "api-status")
        raw = r.read(JSON_LIMIT + 1)
    return json_bytes(raw)


def observe(token):
    a = api_json(f"/actions/artifacts/{ARTIFACT}", token)
    r = api_json(f"/actions/runs/{RUN}", token)
    m = api_json("/git/ref/heads/main", token)
    require(a.get("id") == ARTIFACT and a.get("size_in_bytes") == ZIP_BYTES
            and a.get("expired") is False and a.get("digest") == "sha256:" + ZIP_SHA,
            "artifact-identity")
    aw = a.get("workflow_run", {})
    require(aw.get("id") == RUN and aw.get("head_sha") == COMMIT, "artifact-run-binding")
    require(r.get("id") == RUN and r.get("head_sha") == COMMIT
            and r.get("status") == "completed" and r.get("conclusion") == "success"
            and r.get("run_attempt") == 1 and r.get("repository", {}).get("full_name") == REPO,
            "run-identity")
    main = m.get("object", {}).get("sha")
    require(m.get("ref") == "refs/heads/main" and isinstance(main, str)
            and re.fullmatch(r"[0-9a-f]{40}", main), "main-observation")
    # API observations are summarized, never dumped (responses contain provider URLs).
    return {"artifact_id": ARTIFACT, "run_id": RUN, "commit": COMMIT,
            "artifact_expired": False, "artifact_digest": "sha256:" + ZIP_SHA,
            "run_status": "completed", "run_conclusion": "success", "main_sha": main}


def bounded_copy(stream, out, limit, expected=None):
    count = 0
    h = hashlib.sha256()
    while True:
        budget()
        b = stream.read(min(CHUNK, limit - count + 1))
        if not b:
            break
        count += len(b)
        require(count <= limit, "stream-size-bound")
        h.update(b)
        if out is not None:
            out.write(b)
    require(expected is None or count == expected, "stream-size-mismatch")
    return count, h.hexdigest()


def download(token, path):
    with request(f"/actions/artifacts/{ARTIFACT}/zip", token, True) as response:
        require(response.status == 200, "download-status")
        length = response.headers.get("Content-Length")
        require(length is None or length == str(ZIP_BYTES), "zip-content-length")
        with exclusive(path) as f:
            count, digest = bounded_copy(response, f, ZIP_BYTES, ZIP_BYTES)
            f.flush()
            os.fsync(f.fileno())
    require(digest == ZIP_SHA, "zip-sha256")
    return count, digest


def extract_pinned(zip_path, workdir):
    """Hash complete ZIP first; extract only image gzip and four small metadata files."""
    with open(zip_path, "rb") as f:
        _, digest = bounded_copy(f, None, ZIP_BYTES, ZIP_BYTES)
    require(digest == ZIP_SHA, "zip-sha256")
    wanted = {"backend-image.tar.gz": GZIP_BYTES, "image-receipt.json": JSON_LIMIT,
              "baked/source.json": JSON_LIMIT, "baked/source.sha256": 256,
              "backend-image.sha256": 1024}
    metadata = {}
    with zipfile.ZipFile(zip_path) as z:
        entries = z.infolist()
        require(len(entries) <= 64 and len({v.filename for v in entries}) == len(entries), "zip-entry-bound")
        for entry in entries:
            safe_name(entry.filename)
            mode = entry.external_attr >> 16
            require(not entry.is_dir() and (stat.S_IFMT(mode) in (0, stat.S_IFREG))
                    and not (entry.flag_bits & 1), "zip-entry-type")
        for name, cap in wanted.items():
            item = z.getinfo(name)
            require(item.file_size <= cap, "zip-member-bound")
            with z.open(item) as f:
                if name == "backend-image.tar.gz":
                    with exclusive(workdir / name) as out:
                        _, sha = bounded_copy(f, out, cap, GZIP_BYTES)
                    require(sha == GZIP_SHA, "gzip-sha256")
                else:
                    raw = f.read(cap + 1)
                    require(len(raw) == item.file_size and len(raw) <= cap, "metadata-bound")
                    metadata[name] = raw
    source = metadata["baked/source.json"]
    require(hashlib.sha256(source).hexdigest() == SOURCE
            and metadata["baked/source.sha256"].decode("ascii").strip() == SOURCE, "source-receipt-sha256")
    json_bytes(source)
    receipt = json_bytes(metadata["image-receipt.json"])
    require(receipt.get("status") == "PASS" and receipt.get("image_id") == IMAGE
            and receipt.get("source_snapshot_sha256") == SOURCE
            and receipt.get("runtime_acceptance") is False
            and receipt.get("production_release") is False, "build-source-receipt")
    require(metadata["backend-image.sha256"].decode("ascii").split()[0] == GZIP_SHA, "gzip-receipt")
    return workdir / "backend-image.tar.gz"


class LimitedReader:
    def __init__(self, f, limit):
        self.f, self.limit, self.count = f, limit, 0
    def read(self, n=-1):
        budget()
        n = min(CHUNK if n < 0 else n, self.limit - self.count + 1)
        b = self.f.read(n)
        self.count += len(b)
        require(self.count <= self.limit, "tar-byte-bound")
        return b


def inspect_image(path):
    """Stream tar, hash every blob, retain only manifest and the exact config JSON."""
    blobs = {}
    manifest = config = None
    names = set()
    config_name = "blobs/sha256/" + IMAGE.split(":")[1]
    with gzip.open(path, "rb") as gz:
        stream = LimitedReader(gz, TAR_LIMIT)
        with tarfile.open(fileobj=stream, mode="r|") as t:
            for member in t:
                budget()
                safe_name(member.name)
                require(member.name not in names and len(names) < 256, "tar-entries")
                names.add(member.name)
                # Docker/OCI export may include directories but never links or devices.
                if member.isdir():
                    require(member.size == 0, "tar-directory-size")
                    continue
                require(member.isfile() and 0 <= member.size <= TAR_LIMIT, "tar-entry-type")
                f = t.extractfile(member)
                require(f is not None, "tar-member-stream")
                if member.name in ("manifest.json", config_name):
                    require(member.size <= JSON_LIMIT, "image-json-bound")
                    raw = f.read(JSON_LIMIT + 1)
                    require(len(raw) == member.size, "image-json-size")
                    value = json_bytes(raw)
                    if member.name == "manifest.json":
                        manifest = value
                    else:
                        require(hashlib.sha256(raw).hexdigest() == IMAGE.split(":")[1], "image-config-sha256")
                        config = value
                    sha = hashlib.sha256(raw).hexdigest()
                else:
                    _, sha = bounded_copy(f, None, member.size, member.size)
                if member.name.startswith("blobs/sha256/"):
                    require(re.fullmatch(r"blobs/sha256/[0-9a-f]{64}", member.name)
                            and member.name.rsplit("/", 1)[1] == sha, "image-blob-sha256")
                    blobs[member.name] = sha
        # Consume gzip trailer / any tar padding to enforce CRC and total expansion bound.
        while stream.read(CHUNK):
            pass
    require(isinstance(manifest, list) and len(manifest) == 1 and isinstance(config, dict), "image-manifest-config")
    require(manifest[0].get("Config") == config_name and config.get("os") == "linux"
            and config.get("architecture") == "amd64", "image-platform-config")
    rootfs = config.get("rootfs", {})
    diff_ids = rootfs.get("diff_ids")
    require(rootfs.get("type") == "layers" and isinstance(diff_ids, list) and 0 < len(diff_ids) <= 128
            and all(isinstance(v, str) and re.fullmatch(r"sha256:[0-9a-f]{64}", v) for v in diff_ids), "ordered-diff-ids")
    layers = manifest[0].get("Layers")
    require(isinstance(layers, list) and len(layers) == len(diff_ids), "manifest-layer-count")
    # This pinned Docker export has uncompressed layer tar blobs: ordered byte hashes
    # must equal the config's diff_ids, not just filenames asserted by the manifest.
    require(["sha256:" + blobs.get(safe_name(v), "missing") for v in layers] == diff_ids,
            "manifest-ordered-layer-sha256")
    return {"schema": 1, "image": IMAGE, "image_id": IMAGE, "diff_ids": diff_ids,
            "source_hash": SOURCE, "gzip_sha256": GZIP_SHA,
            "gzip_bytes": GZIP_BYTES, "config_sha256_verified": True,
            "ordered_layer_sha256_verified": True}


def main():
    global DEADLINE
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workdir", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--receipt", type=Path, default=Path("runtime/acquisition.json"))
    args = parser.parse_args()
    os.umask(0o077)
    DEADLINE = time.monotonic() + 180
    token = os.environ.pop("GH_TOKEN", "")
    require(bool(token), "missing-scoped-token")
    require(args.workdir.parent.is_dir() and not args.workdir.exists()
            and not args.workdir.is_symlink(), "fresh-acquisition-directory")
    args.workdir.mkdir(mode=0o700)
    before = observe(token)
    zip_path = args.workdir / "artifact.zip"
    download(token, zip_path)
    archive = extract_pinned(zip_path, args.workdir)
    manifest = inspect_image(archive)
    manifest["source_receipt_verified"] = True  # extract_pinned verified actual ZIP metadata
    # Final fresh artifact/run/main GETs occur immediately before receipt publication.
    after = observe(token)
    require(before == after, "api-identity-or-main-changed")
    zip_path.unlink()  # only own exclusive temporary ZIP; original local archives untouched
    write_json(args.manifest, manifest)
    write_json(args.receipt, {"schema": 1, "status": "PASS", "scope": "exact-image-acquisition-only",
                             "repository": REPO, "before": before, "after": after,
                             "main_unchanged_between_observations": True,
                             "zip_bytes": ZIP_BYTES, "zip_sha256": ZIP_SHA, **manifest,
                             "runtime_acceptance": False, "deployment": False})
    print(json.dumps({"status": "PASS", "image": IMAGE, "source_hash": SOURCE,
                      "gzip_sha256": GZIP_SHA, "config_sha256_verified": True}, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except Refused as e:
        print(json.dumps({"status": "FAIL", "reason": str(e)}))
        sys.exit(2)
    except Exception:
        # urllib error bodies/URLs and config exception strings must never reach public logs.
        print(json.dumps({"status": "FAIL", "reason": "acquisition-exception-redacted"}))
        sys.exit(2)
