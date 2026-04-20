const apiKey = process.env.OPENPHONE_API_KEY;
if (!apiKey) {
  console.error("OPENPHONE_API_KEY not set");
  process.exit(1);
}

const res = await fetch("https://api.openphone.com/v1/phone-numbers", {
  headers: { Authorization: apiKey },
});

if (!res.ok) {
  console.error(`HTTP ${res.status} ${res.statusText}`);
  console.error(await res.text());
  process.exit(1);
}

const { data } = await res.json();
if (!data?.length) {
  console.log("No phone numbers found on this account.");
  process.exit(0);
}

console.log(`Found ${data.length} phone number(s):\n`);
for (const n of data) {
  console.log(`  ID:     ${n.id}`);
  console.log(`  Number: ${n.number}`);
  console.log(`  Name:   ${n.name ?? "(unnamed)"}`);
  console.log(`  Users:  ${(n.users ?? []).map((u) => u.email ?? u.id).join(", ") || "(none)"}`);
  console.log("");
}
