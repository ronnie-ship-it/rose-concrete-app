"use client";

export function PrintButton() {
  return (
    <div className="no-print" style={{ marginBottom: 16 }}>
      <button
        type="button"
        onClick={() => window.print()}
        style={{
          padding: "6px 12px",
          border: "1px solid #ccc",
          borderRadius: 4,
          background: "#fff",
          cursor: "pointer",
        }}
      >
        Print / Save as PDF
      </button>
    </div>
  );
}
