"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-hot-toast";

import * as api from "@herobm/sdk";
import { Button } from "@/components/shared/Button";
import InfoCard from "@/components/shared/InfoCard";
import DeliveryAddressSlideOver from "@/components/shared/DeliveryAddressSlideOver";
import { COUNTRIES } from "@herobm/shared";

interface CustomerAddressesTabProps {
  customer: api.CustomerResponseDto | null;
  loadAccount: () => void;
}

export function CustomerAddressesTab({
  customer,
  loadAccount,
}: CustomerAddressesTabProps) {
  const t = useTranslations();

  const [isAddressSlideOverOpen, setIsAddressSlideOverOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<api.DeliveryAddressResponseDto | null>(null);

  if (!customer) return null;

  const handleAddAddressClick = () => {
    setEditingAddress(null);
    setIsAddressSlideOverOpen(true);
  };

  const handleEditAddressClick = (addr: api.DeliveryAddressResponseDto) => {
    setEditingAddress(addr);
    setIsAddressSlideOverOpen(true);
  };

  const handleDeleteAddressClick = async (addressId: string) => {
    if (window.confirm("Are you sure you want to delete this delivery address?")) {
      try {
        await api.deliveryAddressesControllerRemove(addressId);
        toast.success("Delivery address deleted");
        loadAccount();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h3 className="section-heading mb-0">
            { }
            { }
            <span className="material-symbols-outlined">local_shipping</span>
            {t("customers.deliveryAddresses")}
          </h3>
          { }
          <Button variant="primary" size="sm" onClick={handleAddAddressClick}>
            {t("portal.addAddress")}
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customer.deliveryAddresses && customer.deliveryAddresses.length > 0 ? (
            customer.deliveryAddresses.map(
              (addr: any /* eslint-disable-line @typescript-eslint/no-explicit-any -- Unresolved nested DTO type */) => (
                <InfoCard
                  key={addr.id}
                  title={addr.addressName || "Unnamed Address"}
                  isPrimary={addr.isPrimary}
                  headerRight={
                    <>
                      <div className="flex gap-1 ml-auto">
                        <Button
                          variant="ghost"
                          type="button"
                          className="text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors p-1 flex items-center justify-center rounded-md cursor-pointer"
                          onClick={() => handleEditAddressClick(addr)}
                          title="Edit Address"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          type="button"
                          className="text-[var(--text-muted)] hover:text-red-400 transition-colors p-1 flex items-center justify-center rounded-md cursor-pointer"
                          onClick={() => handleDeleteAddressClick(addr.id)}
                          title="Delete Address"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </Button>
                      </div>
                    </>
                  }
                >
                  <div className="mt-2 flex flex-col gap-0.5">
                    {(addr.recipientName || addr.recipientPhone) && (
                      <div className="text-sm font-medium text-[var(--text-secondary)]">
                        {[addr.recipientName, addr.recipientPhone].filter(Boolean).join(" - ")}
                      </div>
                    )}
                    <div className="text-sm text-[var(--text-primary)] font-medium">{addr.addressLine1}</div>
                    {addr.addressLine2 && <div className="text-sm text-[var(--text-secondary)]">{addr.addressLine2}</div>}
                    <div className="text-sm text-[var(--text-secondary)]">
                      {addr.city}
                      {addr.city && (addr.stateOrProvince || addr.postalCode) ? ", " : ""}
                      {addr.stateOrProvince} {addr.postalCode}
                    </div>
                    <div className="text-sm text-[var(--text-muted)]">
                      {COUNTRIES.find((c) => c.code === addr.country)?.name || addr.country}
                    </div>
                  </div>
                </InfoCard>
              )
            )
          ) : (
            <>
              <div className="text-[var(--text-muted)] text-sm py-4">{t("portal.noDeliveryAddressesFound")}</div>
            </>
          )}
        </div>
      </div>

      {customer && (
        <DeliveryAddressSlideOver
          isOpen={isAddressSlideOverOpen}
          onClose={() => setIsAddressSlideOverOpen(false)}
          customerId={customer.customerId}
          customerName={customer.name || ""}
          addressId={editingAddress?.deliveryAddressId}
          existingData={
            editingAddress as any /* eslint-disable-line @typescript-eslint/no-explicit-any -- Form component expects partial interface mismatches */
          }
          defaultCountry={customer.billingAddressCountry || undefined}
          onSaved={() => {
            setIsAddressSlideOverOpen(false);
            loadAccount();
          }}
        />
      )}
    </div>
  );
}
