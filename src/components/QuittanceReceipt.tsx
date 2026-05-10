import Image from "next/image";
import { type QuittanceData } from "@/app/dashboard/quittances/types";

interface Props {
  data: QuittanceData;
  exemplaire: "B" | "Souche";
}

export default function QuittanceReceipt({ data, exemplaire }: Props) {
  const isSouche = exemplaire === "Souche";

  return (
    <div
      className="quittance-receipt bg-white font-serif text-black"
      style={{
        width: "148mm",
        minHeight: "210mm",
        padding: "8mm 10mm",
        fontSize: "9pt",
        lineHeight: "1.4",
        border: "1px solid #4A5C2F",
        position: "relative",
        boxSizing: "border-box",
      }}
    >
      {/* Filigrane exemplaire */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%) rotate(-45deg)",
          fontSize: "48pt",
          fontWeight: "bold",
          color: isSouche ? "rgba(74,92,47,0.06)" : "rgba(201,168,76,0.07)",
          whiteSpace: "nowrap",
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 0,
        }}
      >
        {isSouche ? "SOUCHE" : "EXEMPLAIRE B"}
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>

        {/* ── En-tête ── */}
        <div style={{ textAlign: "center", borderBottom: "2px solid #4A5C2F", paddingBottom: "4mm", marginBottom: "3mm" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6mm", marginBottom: "2mm" }}>
            {/* Logo officiel Douanes */}
            <div style={{ width: "14mm", height: "14mm", flexShrink: 0 }}>
              <Image
                src="/images/logo-douanes.png"
                alt="Logo Douanes Sénégal"
                width={53}
                height={53}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            </div>
            <div>
              <p style={{ fontWeight: "bold", fontSize: "8.5pt", letterSpacing: "0.5px" }}>
                REPUBLIQUE DU SENEGAL
              </p>
              <p style={{ fontSize: "7.5pt" }}>Un Peuple — Un But — Une Foi</p>
              <p style={{ fontWeight: "bold", fontSize: "7.5pt", marginTop: "1mm" }}>
                MINISTERE DES FINANCES ET DU BUDGET
              </p>
              <p style={{ fontWeight: "bold", fontSize: "7.5pt" }}>
                DIRECTION GENERALE DES DOUANES
              </p>
            </div>
          </div>

          {/* Bandeau titre */}
          <div style={{
            backgroundColor: "#4A5C2F",
            color: "white",
            padding: "2mm 4mm",
            marginTop: "2mm",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <span style={{ fontWeight: "bold", fontSize: "10pt", letterSpacing: "2px" }}>
              RECU DE PAIEMENT — RS
            </span>
            <span style={{
              backgroundColor: "#C9A84C",
              color: "#4A5C2F",
              fontWeight: "bold",
              padding: "0.5mm 3mm",
              fontSize: "9pt",
            }}>
              N° {data.numero}
            </span>
          </div>

          {/* Exemplaire */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "1.5mm",
            fontSize: "7.5pt",
          }}>
            <span style={{
              border: `1.5px solid ${isSouche ? "#4A5C2F" : "#C9A84C"}`,
              padding: "0.5mm 3mm",
              fontWeight: "bold",
              color: isSouche ? "#4A5C2F" : "#8B7232",
              backgroundColor: isSouche ? "#f0f2eb" : "#fdf8ec",
            }}>
              {isSouche ? "SOUCHE — Exemplaire Brigade" : "B — Exemplaire Redevable"}
            </span>
            <span>Brigade : <strong>{data.brigade}</strong></span>
          </div>
        </div>

        {/* ── Corps ── */}

        {/* Redevable */}
        <div style={{ marginBottom: "2.5mm" }}>
          <Row label="Reçu de M./Mme" value={`${data.prenom} ${data.nom}`} bold />
          <Row label="Demeurant à" value={data.adresse} />
          <Row label="Pièce d'identité N°" value={data.pieceIdentite} />
          <Row label="Profession" value={data.profession} />
        </div>

        <Separator />

        {/* Somme */}
        <div style={{ margin: "2.5mm 0" }}>
          <div style={{
            backgroundColor: "#f8f9f5",
            border: "1px solid #c8d4b0",
            padding: "2.5mm 3mm",
            marginBottom: "2mm",
          }}>
            <p style={{ fontSize: "7.5pt", color: "#666", marginBottom: "1mm" }}>
              La somme de (en lettres) :
            </p>
            <p style={{ fontWeight: "bold", fontSize: "9pt", fontStyle: "italic", color: "#2d3c1a" }}>
              {data.montantLettres}
            </p>
          </div>
          <Row label="En chiffres" value={
            new Intl.NumberFormat("fr-SN", { maximumFractionDigits: 0 }).format(data.montant) + " FCFA"
          } bold />
        </div>

        <Separator />

        {/* Nature / Référence */}
        <div style={{ margin: "2.5mm 0" }}>
          <Row label="Au titre de" value={data.nature} bold />
          <Row label="Référence A/C N°" value={data.referenceAC || "—"} />
        </div>

        <Separator />

        {/* Lieu et date */}
        <div style={{ margin: "2.5mm 0" }}>
          <p style={{ fontSize: "8.5pt" }}>
            Fait à <strong>{data.lieu}</strong>, le <strong>{
              new Date(data.date).toLocaleDateString("fr-SN", {
                day: "numeric", month: "long", year: "numeric",
              })
            }</strong>
          </p>
        </div>

        {/* ── Signature ── */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginTop: "6mm",
          gap: "4mm",
        }}>
          {/* Cachet */}
          <div style={{
            width: "40mm",
            height: "30mm",
            border: "1.5px dashed #aaa",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}>
            <p style={{ fontSize: "7pt", color: "#bbb", textAlign: "center" }}>
              CACHET<br />OFFICIEL
            </p>
          </div>

          {/* Signataire */}
          <div style={{ textAlign: "center", flex: 1 }}>
            <p style={{ fontWeight: "bold", fontSize: "8pt", marginBottom: "1mm" }}>
              Le Chef de Brigade
            </p>
            <p style={{ fontSize: "8pt", marginBottom: "6mm" }}>
              {data.chefBrigade}
            </p>
            <div style={{
              borderBottom: "1px solid #4A5C2F",
              width: "45mm",
              margin: "0 auto",
              marginBottom: "1mm",
            }} />
            <p style={{ fontSize: "7pt", color: "#666" }}>Signature et cachet</p>
          </div>
        </div>

        {/* Pied de page */}
        <div style={{
          marginTop: "5mm",
          paddingTop: "2mm",
          borderTop: "1px solid #c8d4b0",
          textAlign: "center",
          fontSize: "6.5pt",
          color: "#888",
        }}>
          Ce reçu est un document officiel des Douanes de la République du Sénégal.
          Toute falsification est passible de poursuites judiciaires.
        </div>

      </div>
    </div>
  );
}

// ── Composants internes ────────────────────────────────────────────────────────
function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "baseline",
      marginBottom: "1.2mm",
      fontSize: "8.5pt",
      gap: "2mm",
    }}>
      <span style={{ color: "#555", minWidth: "36mm", flexShrink: 0 }}>
        {label} :
      </span>
      <span style={{
        fontWeight: bold ? "bold" : "normal",
        flex: 1,
        borderBottom: "0.5px dotted #ccc",
        paddingBottom: "0.3mm",
      }}>
        {value || "—"}
      </span>
    </div>
  );
}

function Separator() {
  return (
    <hr style={{ border: "none", borderTop: "0.5px solid #d4dcc4", margin: "1.5mm 0" }} />
  );
}
