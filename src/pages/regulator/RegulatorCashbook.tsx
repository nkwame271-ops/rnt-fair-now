import CashbookReport from "@/components/regulator/CashbookReport";

const RegulatorCashbook = () => {
  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Automated Cashbook</h1>
        <p className="text-sm text-muted-foreground">
          One payment = one ledger = one receipt = one cashbook row. Entries are posted automatically
          from reconciled payment receipts.
        </p>
      </div>
      <CashbookReport />
    </div>
  );
};

export default RegulatorCashbook;
