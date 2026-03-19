import os
import requests
import smtplib
import traceback
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from datetime import datetime, timezone

# --- CONFIGURATION ---
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SENDER_EMAIL = "taswell@ecomplete.co.za"
SENDER_PASSWORD = "evpd vqfd vwku krkn" 
RECIPIENT_EMAIL = "aaaaowhu3bq4mygzm5ocm4n3ge@ecomplete.slack.com"

STORES = [
    {"name": "Diesel", "url": "diesel-dev-south-africa.myshopify.com"},
    {"name": "Hurley", "url": "hurley-dev-south-africa.myshopify.com"},
    {"name": "Jeep Apparel", "url": "jeep-apparel-dev-south-africa.myshopify.com"},
    {"name": "Reebok", "url": "reebok-dev-south-africa.myshopify.com"},
    {"name": "Superdry", "url": "superdry-dev-south-africa.myshopify.com"}
]

# --- LOGIC ---
def fetch_all_rmas(session, headers, status, store_name):
    all_rmas = []
    cursor = None # Start with no cursor
    
    print(f"   > [{store_name}] Fetching {status} records...", end="", flush=True)
    
    while True:
        try:
            # Build URL with cursor
            base_url = f"https://api.returngo.ai/rmas?status={status}&pagesize=50"
            if cursor:
                url = f"{base_url}&cursor={cursor}"
            else:
                url = base_url
            
            res = session.get(url, headers=headers, timeout=15)
            
            if res.status_code != 200: 
                print(f" Error {res.status_code}")
                break
            
            response_data = res.json()
            data = response_data.get("rmas", [])
            
            if not data:
                break
            
            print(".", end="", flush=True)
            all_rmas.extend(data)
            
            # Check for next cursor
            cursor = response_data.get("next_cursor")
            if not cursor:
                break
                
        except Exception as e: 
            print(f" Error: {e}")
            break
            
    print(f" Done. ({len(all_rmas)})")
    return all_rmas

def get_store_data():
    session = requests.Session()
    retries = Retry(total=3, backoff_factor=0.5, status_forcelist=[500, 502, 503, 504])
    session.mount('https://', HTTPAdapter(max_retries=retries))
    
    report_data = []
    missing_track_list = []
    totals = {"Pending": 0, "Approved": 0, "Received": 0, "NoTrack": 0}
    
    print("🚀 Starting Sync Process...")
    for store in STORES:
        print(f"=== Syncing {store['name']} ===")
        headers = {"X-API-KEY": MY_API_KEY, "x-shop-name": store["url"]}
        store_stats = {"name": store["name"], "Pending": 0, "Approved": 0, "Received": 0, "NoTrack": 0}

        for status in ["Pending", "Approved", "Received"]:
            try:
                rmas = fetch_all_rmas(session, headers, status, store["name"])
                count = len(rmas)
                store_stats[status] = count
                totals[status] += count
                
                if status == "Approved" and count > 0:
                    no_track_count = 0
                    print(f"      - Scanning {count} Approved items for issues...")
                    for i, rma in enumerate(rmas):
                        if i % 10 == 0: print(f"        Scanning {i}/{count}...", end="\r")
                        
                        try:
                            det = session.get(f"https://api.returngo.ai/rma/{rma['rmaId']}", headers=headers, timeout=10).json()
                            shipments = det.get('shipments', [])
                            if not shipments or all(not s.get('trackingNumber') for s in shipments):
                                no_track_count += 1
                                raw_create = det.get('createdAt') or rma.get('createdAt')
                                raw_update = det.get('lastUpdated')
                                days_since = "0"
                                if raw_update:
                                    try:
                                        d = datetime.fromisoformat(raw_update.replace('Z', '+00:00'))
                                        days_since = str((datetime.now(timezone.utc) - d).days)
                                    except: days_since = "-"
                                
                                missing_track_list.append({
                                    "Store": store["name"],
                                    "RMA": rma.get('rmaId'),
                                    "Order": rma.get('order_name'),
                                    "Created": str(raw_create)[:10] if raw_create else "N/A",
                                    "Updated": str(raw_update)[:10] if raw_update else "N/A",
                                    "Days": days_since
                                })
                        except: pass
                    print(f"      - Scan Complete. Found {no_track_count} issues.")
                    store_stats["NoTrack"] = no_track_count
                    totals["NoTrack"] += no_track_count
            except: pass
        report_data.append(store_stats)
    return report_data, missing_track_list, totals

def generate_email_body(summary_data, detail_data, totals):
    html = f"""
    <html>
    <head>
    <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; color: #333; }}
        h2 {{ color: #1f538d; margin-bottom: 5px; }}
        table {{ border-collapse: collapse; width: 100%; max-width: 700px; margin-bottom: 20px; border: 1px solid #ddd; }}
        th, td {{ padding: 8px 12px; text-align: left; border: 1px solid #ddd; font-size: 14px; }}
        th {{ background-color: #1f538d; color: white; border: 1px solid #1f538d; }}
        tr:nth-child(even) {{ background-color: #f8f9fa; }}
        .highlight {{ color: #d9534f; font-weight: bold; }}
        .total-row {{ background-color: #e9ecef !important; font-weight: bold; border-top: 2px solid #666; }}
        .alert-row {{ background-color: #fff3f3 !important; }}
    </style>
    </head>
    <body>
        <h2>Bounty Apparel RMA Snapshot | {datetime.now().strftime('%d %b')}</h2>
        <p style="color: #666; font-size: 12px;">Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M')}</p>
        
        <table>
            <tr>
                <th style="width: 30%;">Store</th>
                <th style="width: 15%;">Pending</th>
                <th style="width: 15%;">Approved</th>
                <th style="width: 15%;">Received</th>
                <th style="width: 25%;">No Tracking (Action Req.)</th>
            </tr>
    """
    for row in summary_data:
        no_track_style = 'class="highlight"' if row['NoTrack'] > 0 else ''
        html += f"""
            <tr>
                <td><strong>{row['name']}</strong></td>
                <td>{row['Pending']}</td>
                <td>{row['Approved']}</td>
                <td>{row['Received']}</td>
                <td {no_track_style}>{row['NoTrack']}</td>
            </tr>
        """
    
    html += f"""
        <tr class="total-row">
            <td>TOTAL</td>
            <td>{totals['Pending']}</td>
            <td>{totals['Approved']}</td>
            <td>{totals['Received']}</td>
            <td>{totals['NoTrack']}</td>
        </tr>
    </table>
    """

    if detail_data:
        html += f"""
        <h3 style="color: #d9534f; margin-top: 30px; border-bottom: 2px solid #d9534f;">⚠️ Action Required: Missing Tracking Details ({len(detail_data)})</h3>
        <table>
            <tr>
                <th style="background-color: #d9534f; border: 1px solid #d9534f; width: 20%;">Store</th>
                <th style="background-color: #d9534f; border: 1px solid #d9534f; width: 15%;">RMA ID</th>
                <th style="background-color: #d9534f; border: 1px solid #d9534f; width: 15%;">Order #</th>
                <th style="background-color: #d9534f; border: 1px solid #d9534f; width: 20%;">Created</th>
                <th style="background-color: #d9534f; border: 1px solid #d9534f; width: 20%;">Updated</th>
                <th style="background-color: #d9534f; border: 1px solid #d9534f; width: 10%;">Days</th>
            </tr>
        """
        for row in detail_data:
            html += f"""
            <tr class="alert-row">
                <td>{row['Store']}</td>
                <td><strong>{row['RMA']}</strong></td>
                <td>{row['Order']}</td>
                <td>{row['Created']}</td>
                <td>{row['Updated']}</td>
                <td style="font-weight: bold;">{row['Days']}</td>
            </tr>
            """
        html += "</table>"
    else:
        html += "<p style='color: green; font-weight: bold; margin-top: 20px;'>✅ Excellent! No approved returns are missing tracking numbers.</p>"

    html += "<p style='font-size: 11px; color: #999; margin-top: 30px;'><em>Automated Report</em></p></body></html>"
    return html

def send_email(html_content):
    msg = MIMEMultipart()
    msg['From'] = SENDER_EMAIL
    msg['To'] = RECIPIENT_EMAIL
    msg['Subject'] = f"Bounty Apparel RMA Snapshot | {datetime.now().strftime('%d %b')}"
    msg.attach(MIMEText(html_content, 'html'))
    
    server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
    server.starttls()
    server.login(SENDER_EMAIL, SENDER_PASSWORD)
    server.send_message(msg)
    server.quit()
    print("✅ Email sent successfully!")

if __name__ == "__main__":
    try:
        if not MY_API_KEY: print("❌ CRITICAL: API Key missing.")
        else:
            summary, details, total_counts = get_store_data()
            email_body = generate_email_body(summary, details, total_counts)
            send_email(email_body)
    except Exception as e:
        print("\n❌ FATAL ERROR:", traceback.format_exc())
        input("\nPress Enter to close...")