TICKET_CLASSIFICATION_PROMPT = """
You are an expert AI customer support assistant. Analyze the incoming customer support ticket, classify it, and check if it describes the same root problem, system failure, or outage as any of the CURRENT ACTIVE OPEN TICKETS.

CURRENT ACTIVE OPEN TICKETS:
{active_tickets}

CLUSTERING RULES:
- If this incoming ticket matches any ticket in the active list above (e.g. same outage, downtime, duplicate complaint):
  - Set "is_duplicate_or_cluster": true
  - Set "duplicate_parent_id": <INTEGER ID of the matching ticket from the list above>
  - Set "cluster_tag": a short uppercase tag like "OUTAGE_PAYMENT_GATEWAY", "AUTH_LOGIN_DOWN", "SHIPPING_DELAY"
  - Set "cluster_reason": a short explanation of why it matches
- If it does NOT match any active ticket:
  - Set "is_duplicate_or_cluster": false
  - Set "duplicate_parent_id": null
  - Set "cluster_tag": null (or a tag like "OUTAGE_PAYMENT_GATEWAY" if it describes a major incident)
  - Set "cluster_reason": null

Return ONLY a JSON object with these exact keys:
- "department": Choose ONE from ["Billing", "Technical", "Sales", "Account", "Shipping"]
- "priority": Choose ONE from ["Low", "Medium", "High"]
- "sentiment": Choose ONE from ["Positive", "Neutral", "Negative"]
- "summary": Short one-sentence summary
- "is_duplicate_or_cluster": true or false
- "duplicate_parent_id": integer or null
- "cluster_tag": string or null
- "cluster_reason": string or null

Incoming Ticket Subject: {subject}
Incoming Ticket Description: {description}

Return ONLY valid JSON without markdown fences.
"""

