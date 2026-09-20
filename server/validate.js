// =============================
// Server-side input validation.
// Never trust data from the client, even from the admin panel — a valid
// login only proves who you are, not that every field you send is safe or
// well-formed. Every write endpoint runs its input through this first.
// =============================

// Trims a string, strips control characters (including CR/LF), and caps
// its length. Returns "" for non-strings so a malicious/odd payload (e.g.
// an object or array) can't reach the DB layer.
//
// The CR/LF stripping matters beyond just "clean data": several fields
// here (enquiry type, name) end up inside an email subject/header built by
// nodemailer. A library-level fix for header injection is good, but this
// app shouldn't rely on that alone — stripping control characters at the
// point of input means it's safe even if a mail library regresses later.
export function str(value, max = 500) {
  if (typeof value !== "string") return "";
  return value.replace(/[\r\n\t\x00-\x1F\x7F]/g, " ").trim().slice(0, max);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+()\-\s]{6,20}$/;
// Must match the <select> options on the Contact page exactly — anything
// else falls back to "General" rather than being trusted as free text that
// later gets embedded in an email subject line.
const ENQUIRY_TYPES = ["General", "PCD Franchise", "Third-Party Manufacturing", "Product Enquiry"];

export function validateEnquiry(body) {
  const errors = [];
  const name = str(body.name, 120);
  const phone = str(body.phone, 30);
  const email = str(body.email, 160);
  const city = str(body.city, 120);
  const rawType = str(body.type, 60);
  const type = ENQUIRY_TYPES.includes(rawType) ? rawType : "General";
  const message = str(body.message, 3000);

  if (!name) errors.push("Name is required.");
  if (!phone || !PHONE_RE.test(phone)) errors.push("A valid phone number is required.");
  if (email && !EMAIL_RE.test(email)) errors.push("Email address looks invalid.");
  if (!message) errors.push("Message is required.");

  return {errors, data: {name, phone, email, city, type, message}};
}

export function validateProduct(body, {partial = false} = {}) {
  const errors = [];
  const name = str(body.name, 200);
  const composition = str(body.composition, 500);
  const dosage_form = str(body.dosage_form, 100);
  const category = str(body.category, 100) || "General";
  const description = str(body.description, 3000);
  let image_url = str(body.image_url, 300) || "/products/product-placeholder.svg";
  // Only allow a same-site relative path or an http(s) URL — never
  // javascript:, data: or anything else that could be smuggled in here.
  if (!/^(\/|https?:\/\/)/i.test(image_url)) image_url = "/products/product-placeholder.svg";

  if (!partial && !name) errors.push("Product name is required.");
  const active = body.active === undefined ? 1 : (body.active ? 1 : 0);

  return {errors, data: {name, composition, dosage_form, category, description, image_url, active}};
}

export function validateStatus(body) {
  const allowed = ["New", "Contacted", "Follow-up", "Converted", "Closed"];
  const status = allowed.includes(body.status) ? body.status : null;
  return {errors: status ? [] : ["Invalid status value."], data: {status}};
}
