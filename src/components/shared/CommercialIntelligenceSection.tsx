import { Building2, Users, Maximize2 } from 'lucide-react';
import type { CompetitionInfo, ShopProfile } from '../../types/commercialEntity';

interface Props {
  competition?: CompetitionInfo;
  shopProfile?: ShopProfile;
  editable?: boolean;
}

export function CommercialIntelligenceSection({
  competition,
  shopProfile,
}: Props) {
  return (
    <section className="bg-card text-card-foreground rounded-xl shadow-md p-6 space-y-6">
      {/* Competition */}
      <div>
        <h2 className="text-lg font-semibold mb-2">⚔️ Ανταγωνισμός</h2>
        {competition ? (
          <div className="text-sm text-muted-foreground space-y-1">
            {competition.mainCompetitor && (
              <div>Κύριος Ανταγωνιστής: {competition.mainCompetitor}</div>
            )}
            {competition.estimatedMonthlySpend && (
              <div>
                Εκτ. δαπάνη: €{competition.estimatedMonthlySpend}/μήνα
              </div>
            )}
            {competition.competitorStrengths && (
              <div className="bg-red-50 p-2 rounded">
                {competition.competitorStrengths}
              </div>
            )}
            {competition.switchReason && (
              <div className="bg-green-50 p-2 rounded">
                {competition.switchReason}
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground/70 italic">
            Δεν υπάρχουν στοιχεία
          </div>
        )}
      </div>

      {/* Shop Profile */}
      <div>
        <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <Building2 className="w-4 h-4" />
          Προφίλ Καταστήματος
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-muted-foreground">
          {shopProfile?.numberOfEmployees !== undefined && (
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground/70" />
              {shopProfile.numberOfEmployees} εργαζόμενοι
            </div>
          )}
          {shopProfile?.shopSizeM2 !== undefined && (
            <div className="flex items-center gap-2">
              <Maximize2 className="w-4 h-4 text-muted-foreground/70" />
              {shopProfile.shopSizeM2} m²
            </div>
          )}
          {shopProfile?.stockBehavior && (
            <div className="col-span-full text-xs bg-muted px-3 py-1 rounded">
              {shopProfile.stockBehavior}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
