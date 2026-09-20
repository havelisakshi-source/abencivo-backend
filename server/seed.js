import "./db.js";
import db from "./db.js";
if(db.prepare("SELECT COUNT(*) c FROM products").get().c===0){
 const add=db.prepare("INSERT INTO products(name,composition,dosage_form,category,image_url,description) VALUES(?,?,?,?,?,?)");
 [
 ["Product Name 01","Add verified composition","Tablet","General","/products/product-placeholder.svg","Demo product — replace with verified details."],
 ["Product Name 02","Add verified composition","Capsule","General","/products/product-placeholder.svg","Demo product — replace with verified details."],
 ["Product Name 03","Add verified composition","Syrup","General","/products/product-placeholder.svg","Demo product — replace with verified details."]
 ].forEach(x=>add.run(...x));
}
console.log("Seed complete.");
