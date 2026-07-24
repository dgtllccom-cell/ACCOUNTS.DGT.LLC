"use client";

import {
  Phone, Mail, MapPin, User, Building2, Receipt, ShoppingCart,
  CreditCard, Clock, Tag, ExternalLink, AlertTriangle
} from "lucide-react";
import type { ConversationDetail } from "../types";
import { StatusBadge } from "./status-badge";
import { formatDateTime } from "../utils/date";

type Props = {
  detail: ConversationDetail;
};

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 py-1.5">
      <Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="truncate text-xs font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

export function ContactPanel({ detail }: Props) {
  const conv = detail.conversation;
  const contact = conv.contact;
  const customer = detail.erpCustomer;

  const contactLabel = contact?.displayName ?? contact?.waProfileName ?? customer?.customerName ?? contact?.phoneNumber ?? "Unknown";

  return (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <div className="border-b border-border/50 p-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366]/15 text-[#25D366] font-bold text-base">
            {contactLabel[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{contactLabel}</p>
            <p className="text-[10px] text-muted-foreground">{contact?.phoneNumber ?? ""}</p>
          </div>
        </div>
        <div className="mt-2">
          <StatusBadge status={conv.status} />
        </div>
      </div>

      {/* Contact info */}
      <div className="border-b border-border/50 px-4 py-2">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Contact</p>
        <InfoRow icon={Phone} label="WhatsApp" value={contact?.phoneNumber} />
        {customer && (
          <>
            <InfoRow icon={User} label="Customer Name" value={customer.customerName} />
            <InfoRow icon={Building2} label="Company" value={customer.companyName} />
            <InfoRow icon={Mail} label="Email" value={customer.email} />
            <InfoRow icon={Phone} label="Mobile" value={customer.mobile} />
            <InfoRow icon={MapPin} label="Address" value={customer.address} />
          </>
        )}
        {!customer && (
          <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-900/20 px-2 py-1.5 text-[10px] text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
            <span>Not linked to an ERP customer</span>
          </div>
        )}
      </div>

      {/* ERP customer data */}
      {customer && (
        <div className="border-b border-border/50 px-4 py-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">ERP Account</p>
          <InfoRow icon={Receipt} label="Country" value={customer.country?.name} />
          {customer.notes && (
            <div className="mt-1 rounded-md bg-muted/50 p-2 text-[10px] text-muted-foreground">
              {customer.notes}
            </div>
          )}
        </div>
      )}

      {/* Conversation meta */}
      <div className="border-b border-border/50 px-4 py-2">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Conversation</p>
        <InfoRow icon={Building2} label="Branch" value={conv.cityBranch ? `${conv.cityBranch.cityName} — ${conv.cityBranch.name}` : conv.country?.name} />
        <InfoRow icon={User} label="Assigned To" value={conv.assignedUser?.fullName} />
        <InfoRow icon={Clock} label="Created" value={formatDateTime(conv.createdAt, "dd MMM yyyy, HH:mm")} />
        {conv.linkedModule && (
          <InfoRow icon={ExternalLink} label="Linked Module" value={`${conv.linkedModule}: ${conv.linkedDocumentNo ?? ""}`} />
        )}
      </div>

      {/* Labels */}
      {(contact?.labels?.length ?? 0) > 0 && (
        <div className="px-4 py-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Labels</p>
          <div className="flex flex-wrap gap-1">
            {contact!.labels.map((label) => (
              <span key={label} className="flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                <Tag className="h-2.5 w-2.5" />
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Activity log */}
      {detail.activity.length > 0 && (
        <div className="px-4 py-2">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Activity</p>
          <div className="space-y-2">
            {detail.activity.slice(0, 8).map((a) => (
              <div key={a.id} className="flex items-start gap-2 text-[10px]">
                <div className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/50 mt-1" />
                <div>
                  <span className="text-foreground/80 capitalize">{a.eventType.replace(/_/g, " ")}</span>
                  {a.actorName && <span className="text-muted-foreground"> by {a.actorName}</span>}
                  <p className="text-muted-foreground/60">{formatDateTime(a.createdAt, "dd MMM, HH:mm")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
