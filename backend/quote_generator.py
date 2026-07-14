from weasyprint import HTML
from datetime import datetime
from database import get_db
import os
import uuid

def get_course_details(course_id):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT code, name, base_fee, installment_count, discount_percent, down_payment FROM course WHERE id = %s", (course_id,))
        row = cur.fetchone()
        if not row:
            raise ValueError("Course not found")
        
        course = {
            "code": row[0],
            "name": row[1],
            "base_fee": row[2],
            "installment_count": row[3],
            "discount_percent": float(row[4]) if row[4] else 0,
            "down_payment": row[5] if row[5] else 0
        }
        
        cur.execute(
            "SELECT description, amount FROM course_line_item WHERE course_id = %s ORDER BY display_order",
            (course_id,)
        )
        course["line_items"] = [{"description": r[0], "amount": r[1]} for r in cur.fetchall()]
        
        return course

def calculate_installments(total_amount, installment_count, down_payment):
    if installment_count == 1:
        return [{"number": 1, "amount": total_amount, "due": "Full payment"}]
    
    remaining = total_amount - down_payment
    installment_amount = remaining // (installment_count - 1)
    remainder = remaining % (installment_count - 1)
    
    installments = [{"number": 1, "amount": down_payment, "due": "Down payment at enrollment"}]
    
    for i in range(installment_count - 1):
        amount = installment_amount + (1 if i < remainder else 0)
        installments.append({
            "number": i + 2,
            "amount": amount,
            "due": f"Month {(i + 1) * 3}"
        })
    
    return installments

def generate_quote_html(lead_name, course, quote_id):
    base_fee = course["base_fee"]
    discount_percent = course["discount_percent"]
    discount_amount = int(base_fee * discount_percent / 100)
    discounted_base = base_fee - discount_amount
    down_payment = course["down_payment"]
    
    total_amount = discounted_base
    
    line_items_html = f'<tr><td>{course["name"]} (Base Fee)</td><td style="text-align:right">₹{base_fee:,}</td></tr>'
    
    if discount_percent > 0:
        line_items_html += f'<tr style="color: green;"><td>Discount ({discount_percent}%)</td><td style="text-align:right">-₹{discount_amount:,}</td></tr>'
        line_items_html += f'<tr style="font-weight: bold;"><td>Subtotal after discount</td><td style="text-align:right">₹{discounted_base:,}</td></tr>'
    
    for item in course["line_items"]:
        if item["amount"] > 0:
            total_amount += item["amount"]
            line_items_html += f'<tr><td>{item["description"]}</td><td style="text-align:right">₹{item["amount"]:,}</td></tr>'
    
    installments = calculate_installments(total_amount, course["installment_count"], down_payment)
    installments_html = '\n'.join([
        f'<tr><td>Installment {inst["number"]}</td><td style="text-align:right">₹{inst["amount"]:,}</td><td>{inst["due"]}</td></tr>'
        for inst in installments
    ])
    
    html = f'''
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Quote - {lead_name}</title>
    </head>
    <body style="font-family: Arial, sans-serif; margin: 40px; color: #333;">
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #1e40af; padding-bottom: 20px;">
            <h1 style="color: #1e40af; margin: 0; font-size: 32px;">We One Aviation</h1>
            <p style="color: #666; margin: 5px 0; font-size: 14px;">DGCA Ground School</p>
            <p style="color: #999; margin: 5px 0; font-size: 12px;">[Logo placeholder - add institute logo here]</p>
        </div>
        
        <div style="margin-bottom: 30px; background-color: #f9f9f9; padding: 15px; border-left: 4px solid #1e40af;">
            <div style="display: inline-block; width: 48%;"><strong>Date:</strong> {datetime.now().strftime('%d %B %Y')}</div>
            <div style="display: inline-block; width: 48%; text-align: right;"><strong>Quote ID:</strong> {quote_id}</div>
            <div style="margin-top: 10px;"><strong>Prepared for:</strong> {lead_name}</div>
        </div>
        
        <h2 style="color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 10px; margin-top: 40px;">
            {course['name']} Training Program
        </h2>
        
        <div style="margin: 30px 0;">
            <h3 style="color: #333;">Fee Breakdown</h3>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                <thead>
                    <tr style="background-color: #1e40af; color: white;">
                        <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Item</th>
                        <th style="padding: 12px; text-align: right; border: 1px solid #ddd;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {line_items_html}
                    <tr style="background-color: #f0f9ff; font-weight: bold; font-size: 16px;">
                        <td style="padding: 12px; border: 1px solid #ddd;">Total Program Fee</td>
                        <td style="padding: 12px; text-align: right; border: 1px solid #ddd;">₹{total_amount:,}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        
        <div style="margin: 40px 0;">
            <h3 style="color: #333;">Payment Schedule ({course["installment_count"]} installments)</h3>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                <thead>
                    <tr style="background-color: #1e40af; color: white;">
                        <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Payment</th>
                        <th style="padding: 12px; text-align: right; border: 1px solid #ddd;">Amount</th>
                        <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Due</th>
                    </tr>
                </thead>
                <tbody>
                    {installments_html}
                </tbody>
            </table>
        </div>
        
        <div style="margin: 30px 0; padding: 15px; background-color: #f0f9ff; border-left: 4px solid #1e40af;">
            <h3 style="margin-top: 0; color: #1e40af;">What's Included</h3>
            <ul style="line-height: 1.8; margin: 0;">
                <li>Complete DGCA syllabus coverage</li>
                <li>Study materials and mock tests</li>
                <li>Experienced instructors</li>
                <li>Exam preparation guidance</li>
            </ul>
        </div>
        
        <div style="margin-top: 50px; padding-top: 20px; border-top: 2px solid #ddd; font-size: 11px; color: #666;">
            <p><strong>Note:</strong> This quote is valid for 30 days from the date of issue. Fees are subject to change as per DGCA regulations.</p>
            <p><strong>PLACEHOLDER fees shown - Admin must update with actual amounts before sending.</strong></p>
            <p style="margin-top: 15px;">For queries, contact us at info@weoneaviation.com</p>
        </div>
    </body>
    </html>
    '''
    return html

def generate_quote_pdf(lead_name, course_id, quote_id, output_path):
    course = get_course_details(course_id)
    html_content = generate_quote_html(lead_name, course, quote_id)
    HTML(string=html_content).write_pdf(output_path)
    return output_path
