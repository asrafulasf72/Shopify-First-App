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
            variants(first: 1) {
              edges {
                node {
                  price
                }
              }
            }
              featuredImage {
                         url
                         altText
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
    const products = data.data.products.edges.map((e) => ({
        ...e.node,
        cursor: e.cursor,
    }));
    const pageInfo = data.data.products.pageInfo;
    return { products, pageInfo, currentCursor: cursor };
};

export default function ProductsPage() {
    const { products, pageInfo, currentCursor } = useLoaderData();
    const navigate = useNavigate();

    const loadNext = () => {
        const last = products[products.length - 1]?.cursor;
        navigate(`/app/products?cursor=${last}`);
    };

    return (
        <s-page heading="Products">

            {/* Header stats bar */}
            <div style={{
                display: "flex",
                gap: "16px",
                marginBottom: "24px",
            }}>
                {[
                    { label: "এই page এ", value: products.length, color: "#6366f1" },
                    { label: "Active", value: products.filter(p => p.status === "ACTIVE").length, color: "#10b981" },
                    { label: "Draft", value: products.filter(p => p.status === "DRAFT").length, color: "#f59e0b" },
                ].map((stat) => (
                    <div key={stat.label} style={{
                        flex: 1,
                        background: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: "12px",
                        padding: "16px 20px",
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                    }}>
                        <div style={{
                            width: "40px", height: "40px",
                            borderRadius: "10px",
                            background: stat.color + "18",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "20px",
                        }}>
                            {stat.label === "এই page এ" ? "📦" : stat.label === "Active" ? "✅" : "📝"}
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

            {/* Table header */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 140px 120px 100px",
                padding: "10px 20px",
                background: "#f9fafb",
                borderRadius: "10px 10px 0 0",
                border: "1px solid #e5e7eb",
                borderBottom: "none",
            }}>
                {["Product", "Price", "Inventory", "Status"].map((h) => (
                    <span key={h} style={{ fontSize: "12px", fontWeight: "600", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {h}
                    </span>
                ))}
            </div>

            {/* Product rows */}
            <div style={{
                border: "1px solid #e5e7eb",
                borderRadius: "0 0 10px 10px",
                overflow: "hidden",
                background: "#fff",
            }}>
                {products.map((product, index) => {
                    const isActive = product.status === "ACTIVE";
                    const price = product.variants.edges[0]?.node.price;

                    return (
                        <div
                            key={product.id}
                            onClick={() => navigate(`/app/products/${product.id.split("/").pop()}`)}
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 140px 120px 100px",
                                padding: "14px 20px",
                                alignItems: "center",
                                borderTop: index === 0 ? "none" : "1px solid #f3f4f6",
                                cursor: "pointer",
                                transition: "background 0.15s",
                                background: "#fff",
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                            onMouseLeave={e => e.currentTarget.style.background = "#fff"}
                        >
                            {/* Title */}
                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                <div style={{
                                    width: "36px", height: "36px",
                                    borderRadius: "8px",
                                    background: "#f3f4f6",
                                    overflow: "hidden",
                                    flexShrink: 0,
                                }}>
                                    {product.featuredImage ? (
                                        <img
                                            src={product.featuredImage.url}
                                            alt={product.featuredImage.altText || product.title}
                                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                        />
                                    ) : (
                                        <div style={{
                                            width: "100%", height: "100%",
                                            display: "flex", alignItems: "center",
                                            justifyContent: "center", fontSize: "16px",
                                        }}>
                                            🛍️
                                        </div>
                                    )}
                                </div>
                                <span style={{
                                    fontWeight: "500",
                                    fontSize: "14px",
                                    color: "#111827",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}>
                                    {product.title}
                                </span>
                            </div>

                            {/* Price */}
                            <span style={{ fontSize: "14px", fontWeight: "600", color: "#111827" }}>
                                ${parseFloat(price).toFixed(2)}
                            </span>

                            {/* Inventory */}
                            <span style={{ fontSize: "13px", color: "#6b7280" }}>
                                {product.totalInventory ?? "—"} in stock
                            </span>

                            {/* Status badge */}
                            <span style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                padding: "4px 10px",
                                borderRadius: "20px",
                                fontSize: "12px",
                                fontWeight: "500",
                                width: "fit-content",
                                background: isActive ? "#d1fae5" : "#f3f4f6",
                                color: isActive ? "#065f46" : "#6b7280",
                            }}>
                                <span style={{
                                    width: "6px", height: "6px",
                                    borderRadius: "50%",
                                    background: isActive ? "#10b981" : "#9ca3af",
                                    display: "inline-block",
                                }} />
                                {isActive ? "Active" : "Draft"}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Pagination */}
            <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "20px",
                padding: "0 4px",
            }}>
                <span style={{ fontSize: "13px", color: "#6b7280" }}>
                    {products.length} product Showing
                </span>
                <div style={{ display: "flex", gap: "8px" }}>
                    {currentCursor && (
                        <button
                            onClick={() => navigate(-1)}
                            style={{
                                padding: "8px 16px",
                                borderRadius: "8px",
                                border: "1px solid #e5e7eb",
                                background: "#fff",
                                fontSize: "13px",
                                fontWeight: "500",
                                cursor: "pointer",
                                color: "#374151",
                            }}
                        >
                            ← Previous
                        </button>
                    )}
                    {pageInfo.hasNextPage && (
                        <button
                            onClick={loadNext}
                            style={{
                                padding: "8px 16px",
                                borderRadius: "8px",
                                border: "none",
                                background: "#6366f1",
                                color: "#fff",
                                fontSize: "13px",
                                fontWeight: "500",
                                cursor: "pointer",
                            }}
                        >
                            Next →
                        </button>
                    )}
                    {!pageInfo.hasNextPage && (
                        <span style={{ fontSize: "13px", color: "#10b981", alignSelf: "center" }}>
                            ✓ All Done
                        </span>
                    )}
                </div>
            </div>

        </s-page>
    );
}