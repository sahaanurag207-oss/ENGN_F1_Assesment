export function classifyTicket(subject, body) {
  const text = `${subject} ${body}`.toLowerCase();

  let category = 'FEATURE_REQUEST';
  if (/(refund|invoice|charge|payment)/.test(text)) {
    category = 'BILLING';
  } else if (/(password|2fa|sign in|locked out|login)/.test(text)) {
    category = 'LOGIN';
  } else if (/(package|arrived|shipping|tracking|delivery)/.test(text)) {
    category = 'DELIVERY';
  } else if (/(crash|error|500|exception|broken)/.test(text)) {
    category = 'BUG';
  }

  let priority = 'MEDIUM';
  if (/(urgent|production down|locked out)/.test(text)) {
    priority = 'URGENT';
  } else if (/(error|refund|not arrived)/.test(text)) {
    priority = 'HIGH';
  }

  return { autoCategory: category, priority };
}

export function escapeLikeWildcards(str) {
  return str.replace(/[\\%_]/g, (match) => `\\${match}`);
}
