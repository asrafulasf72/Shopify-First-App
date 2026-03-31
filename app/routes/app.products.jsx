import { useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");

  const response = await admin.graphql(
    `#graphql
    query getProducts($cursor: String) {
      products(first: 10, after: $cursor) {
        edges {
          node {
            id
            title
            status
            totalInventory
            featuredImage {
              url
              altText
            }
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  compareAtPrice
                  availableForSale
                  displayName
                }
              }
            }
          }
          cursor
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }`,
    { variables: { cursor } }
  );

  const data = await response.json();

  const products = data.data.products.edges.map((e) => {
    const variants = e.node.variants.edges.map((v) => v.node);
    const firstVariant = variants[0];

    const mainPrice = parseFloat(firstVariant?.price || 0);
    const comparePrice = firstVariant?.compareAtPrice
      ? parseFloat(firstVariant.compareAtPrice)
      : null;

    const discount =
      comparePrice && comparePrice > mainPrice
        ? Math.round(((comparePrice - mainPrice) / comparePrice) * 100)
        : null;

    const availableVariants = variants.filter((v) => v.availableForSale).length;
    const totalVariants = variants.length;

    return {
      ...e.node,
      cursor: e.cursor,
      mainPrice,
      comparePrice,
      discount,
      availableVariants,
      totalVariants,
      variants,
    };
  });

  const pageInfo = data.data.products.pageInfo;
  return { products, pageInfo, currentCursor: cursor };
};

// ── Variant progress bar ────────────────────────────────────────────
function VariantPill({ available, total }) {
  const unavailable = total - available;
  const pct = total > 0 ? (available / total) * 100 : 0;
  const barColor =
    available === total ? "#10b981" : available === 0 ? "#ef4444" : "#f59e0b";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      {/* Bar */}
      <div style={{
        width: "80px", height: "6px", borderRadius: "99px",
        background: "#e5e7eb", overflow: "hidden",
      }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: barColor, borderRadius: "99px",
        }} />
      </div>
      {/* Label */}
      <div style={{ fontSize: "11px", display: "flex", gap: "3px", flexWrap: "wrap" }}>
        <span style={{ color: barColor, fontWeight: "600" }}>{available}/{total}</span>
        <span style={{ color: "#9ca3af" }}>
          {unavailable > 0 ? `(${unavailable} out)` : "✓ all ok"}
        </span>
      </div>
    </div>
  );
}

// ── Small action button ─────────────────────────────────────────────
function ActionBtn({ onClick, title, bg = "#fff", border = "#e5e7eb", icon }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: "28px", height: "28px", borderRadius: "6px",
        border: `1px solid ${border}`, background: bg,
        cursor: "pointer", fontSize: "13px",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {icon}
    </button>
  );
}

// ── Main page ───────────────────────────────────────────────────────
export default function ProductsPage() {
  const { products, pageInfo, currentCursor } = useLoaderData();
  const navigate = useNavigate();

  const loadNext = () => {
    const last = products[products.length - 1]?.cursor;
    navigate(`/app/products?cursor=${last}`);
  };

  // grid: product col flexible, বাকিগুলো fixed — Action এ 96px দিলে 3 button ঠিক fit করে
  const COLS = "minmax(140px,2fr) 84px 96px 78px 108px 76px 96px";

  return (
    <s-page heading="Products">

      {/* ── Stats ── */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
        {[
          { label: "এই page এ", value: products.length, color: "#6366f1", icon: "📦" },
          { label: "Active", value: products.filter((p) => p.status === "ACTIVE").length, color: "#10b981", icon: "✅" },
          { label: "Draft", value: products.filter((p) => p.status === "DRAFT").length, color: "#f59e0b", icon: "📝" },
          { label: "Low stock", value: products.filter((p) => p.totalInventory < 3).length, color: "#ef4444", icon: "⚠️" },
        ].map((stat) => (
          <div key={stat.label} style={{
            flex: 1, background: "#fff", border: "1px solid #e5e7eb",
            borderRadius: "12px", padding: "16px 20px",
            display: "flex", alignItems: "center", gap: "14px",
          }}>
            <div style={{
              width: "40px", height: "40px", borderRadius: "10px",
              background: stat.color + "18",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "20px",
            }}>
              {stat.icon}
            </div>
            <div>
              <div style={{ fontSize: "22px", fontWeight: "700", color: stat.color, lineHeight: 1.2 }}>
                {stat.value}
              </div>
              <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
                {stat.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Table ── */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: "10px", overflow: "hidden" }}>

        {/* Header */}
        <div style={{
          display: "grid", gridTemplateColumns: COLS,
          padding: "10px 16px",
          background: "#f9fafb", borderBottom: "1px solid #e5e7eb",
        }}>
          {["Product", "Price", "Compare", "Disc.", "Variants", "Status", "Action"].map((h) => (
            <span key={h} style={{
              fontSize: "11px", fontWeight: "600", color: "#6b7280",
              textTransform: "uppercase", letterSpacing: "0.04em",
            }}>
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        {products.map((product, index) => {
          const isActive = product.status === "ACTIVE";
          const isLowStock = product.totalInventory < 3;

          return (
            <div
              key={product.id}
              onClick={() => navigate(`/app/products/${product.id.split("/").pop()}`)}
              style={{
                display: "grid", gridTemplateColumns: COLS,
                padding: "12px 16px", alignItems: "center",
                borderTop: index === 0 ? "none" : "1px solid #f3f4f6",
                cursor: "pointer", transition: "background 0.15s",
                background: isLowStock ? "#fff5f5" : "#fff",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = isLowStock ? "#ffe4e4" : "#f9fafb")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = isLowStock ? "#fff5f5" : "#fff")
              }
            >
              {/* Product */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                <div style={{
                  width: "34px", height: "34px", borderRadius: "8px",
                  background: "#f3f4f6", overflow: "hidden", flexShrink: 0,
                }}>
                  {product.featuredImage ? (
                    <img
                      src={product.featuredImage.url}
                      alt={product.featuredImage.altText || product.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <div style={{
                      width: "100%", height: "100%", display: "flex",
                      alignItems: "center", justifyContent: "center", fontSize: "15px",
                    }}>🛍️</div>
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontWeight: "500", fontSize: "13px", color: "#111827",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {product.title}
                  </div>
                  {isLowStock && (
                    <span style={{ fontSize: "10px", color: "#dc2626", fontWeight: "600" }}>
                      ⚠️ Low stock
                    </span>
                  )}
                </div>
              </div>

              {/* Price */}
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#111827" }}>
                ${product.mainPrice.toFixed(2)}
              </span>

              {/* Compare */}
              <span>
                {product.comparePrice ? (
                  <s style={{ color: "#9ca3af", fontSize: "12px" }}>
                    ${product.comparePrice.toFixed(2)}
                  </s>
                ) : (
                  <span style={{ color: "#d1d5db" }}>—</span>
                )}
              </span>

              {/* Discount */}
              <span>
                {product.discount ? (
                  <span style={{
                    background: "#fef3c7", color: "#92400e",
                    padding: "2px 7px", borderRadius: "12px",
                    fontSize: "11px", fontWeight: "700",
                  }}>
                    -{product.discount}%
                  </span>
                ) : (
                  <span style={{ color: "#d1d5db" }}>—</span>
                )}
              </span>

              {/* Variants */}
              <VariantPill
                available={product.availableVariants}
                total={product.totalVariants}
              />

              {/* Status */}
              <span style={{
                display: "inline-flex", alignItems: "center", gap: "4px",
                padding: "3px 8px", borderRadius: "20px",
                fontSize: "11px", fontWeight: "500", width: "fit-content",
                background: isActive ? "#d1fae5" : "#f3f4f6",
                color: isActive ? "#065f46" : "#6b7280",
              }}>
                <span style={{
                  width: "5px", height: "5px", borderRadius: "50%",
                  background: isActive ? "#10b981" : "#9ca3af",
                  display: "inline-block",
                }} />
                {isActive ? "Active" : "Draft"}
              </span>

              {/* Action — 3 fixed-size buttons, always visible */}
              <div
                style={{ display: "flex", gap: "4px" }}
                onClick={(e) => e.stopPropagation()}
              >
                <ActionBtn
                  icon="👁️"
                  title="Details দেখো"
                  onClick={() => navigate(`/app/products/${product.id.split("/").pop()}`)}
                />
                <ActionBtn
                  icon="📋"
                  title="Duplicate"
                  onClick={() => alert("Duplicate — next step এ আসবে!")}
                />
                <ActionBtn
                  icon="🗑️"
                  title="Delete"
                  bg="#fff5f5"
                  border="#fee2e2"
                  onClick={() => {
                    if (confirm(`"${product.title}" delete করবে?`)) {
                      alert("Delete — next step এ implement হবে!");
                    }
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Pagination ── */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "center", marginTop: "20px", padding: "0 4px",
      }}>
        <span style={{ fontSize: "13px", color: "#6b7280" }}>
          {products.length} products showing
        </span>
        <div style={{ display: "flex", gap: "8px" }}>
          {currentCursor && (
            <button
              onClick={() => navigate(-1)}
              style={{
                padding: "8px 16px", borderRadius: "8px",
                border: "1px solid #e5e7eb", background: "#fff",
                fontSize: "13px", fontWeight: "500",
                cursor: "pointer", color: "#374151",
              }}
            >
              ← Previous
            </button>
          )}
          {pageInfo.hasNextPage ? (
            <button
              onClick={loadNext}
              style={{
                padding: "8px 16px", borderRadius: "8px",
                border: "none", background: "#6366f1",
                color: "#fff", fontSize: "13px",
                fontWeight: "500", cursor: "pointer",
              }}
            >
              Next →
            </button>
          ) : (
            <span style={{ fontSize: "13px", color: "#10b981", alignSelf: "center" }}>
              ✓ All Seen
            </span>
          )}
        </div>
      </div>

    </s-page>
  );
}