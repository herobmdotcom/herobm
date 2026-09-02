#!/usr/bin/env python3
"""
HEROBM - exe.dev Email Sender
Reads stdin and sends it as the body of an email via the exe.dev local gateway.
Usage: python3 scripts/send-email.py --to "user@example.com" --subject "My Subject" < message.txt
"""

import sys
import json
import urllib.request
import argparse

def main():
    parser = argparse.ArgumentParser(description="Send email via exe.dev gateway")
    parser.add_argument("--to", required=True, help="Recipient email address")
    parser.add_argument("--subject", required=True, help="Email subject")
    args = parser.parse_args()

    # Read the entire body from stdin
    body = sys.stdin.read()

    url = "http://169.254.169.254/gateway/email/send"
    payload = {
        "to": args.to,
        "subject": args.subject,
        "body": body
    }

    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})

    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode('utf-8')
            if response.status >= 400:
                print(f"Error sending email: HTTP {response.status} - {res_body}", file=sys.stderr)
                sys.exit(1)
            else:
                # Optionally print response if debugging is needed
                pass
    except Exception as e:
        print(f"Failed to send email: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
