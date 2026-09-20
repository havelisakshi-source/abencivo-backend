import dotenv from "dotenv";
dotenv.config();

// =============================
// WHO GETS NOTIFIED — edit freely.
// Each enquiry "type" (chosen in the website's contact form) is routed to
// one named person. Names are safe to hardcode; the actual email address
// for each person is read from .env so it's not committed to source control.
// If a person's email isn't set in .env, it falls back to MAIL_TO so
// nothing ever silently goes nowhere.
// =============================
export const TEAM = {
  "PCD Franchise": {
    name: process.env.FRANCHISE_MANAGER_NAME || "Franchise Manager",
    email: process.env.FRANCHISE_MANAGER_EMAIL || process.env.MAIL_TO || ""
  },
  "Third-Party Manufacturing": {
    name: process.env.MANUFACTURING_MANAGER_NAME || "Manufacturing Manager",
    email: process.env.MANUFACTURING_MANAGER_EMAIL || process.env.MAIL_TO || ""
  },
  "Product Enquiry": {
    name: process.env.SALES_MANAGER_NAME || "Sales Manager",
    email: process.env.SALES_MANAGER_EMAIL || process.env.MAIL_TO || ""
  },
  General: {
    name: process.env.GENERAL_MANAGER_NAME || "Customer Care",
    email: process.env.MAIL_TO || ""
  }
};

// Look up the responsible person for a given enquiry type, falling back
// to General if the type doesn't match a known department.
export function recipientFor(type) {
  return TEAM[type] || TEAM.General;
}
