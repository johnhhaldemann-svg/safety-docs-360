import { InjuryWeatherDashboard } from "@/components/injury-weather/InjuryWeatherDashboard";
import { InjuryWeatherPageChrome } from "@/components/injury-weather/InjuryWeatherPageChrome";

export default function SuperadminInjuryWeatherPage() {
  return (
    <div>
      <InjuryWeatherPageChrome />
      <InjuryWeatherDashboard />
    </div>
  );
}
