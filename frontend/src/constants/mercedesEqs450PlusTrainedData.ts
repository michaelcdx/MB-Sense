export const mercedesEqs450PlusMockData = {
  vehicle: {
    brand: "Mercedes-Benz",
    model: "EQS 450+ Sedan",
    year: 2026,
    batteryCapacityKWh: 118,
    epaRangeMiles: 390,
    epaRangeKm: 627.6,
    acChargingPowerWatt: 9600,
    dcFastChargingPowerWatt: 200000,
    acChargeTime10To100Hours: 14,
    dcChargeTime10To80Minutes: 31
  },

  assumptions: {
    rangeCalculation: "linear based on EPA range",
    batteryEnergyCalculation: "linear based on 118 kWh battery capacity",
    driveHoursAt60Kmh: "estimated driving time if average speed is 60 km/h",
    driveHoursAt100Kmh: "estimated driving time if average speed is 100 km/h",
    acChargingPer1Percent: "about 9.33 minutes per 1% from 10% to 100%",
    dcChargingPer1Percent10To80: "about 0.44 minutes per 1% from 10% to 80%",
    dcChargingAbove80: "not included because Mercedes only publishes 10% to 80% DC fast charging time"
  },

  batteryPercentageData: [
    {
      socPercent: 10,
      batteryEnergyKWh_est: 11.8,
      remainingRangeKm_est: 62.8,
      remainingRangeMiles_est: 39.0,
      driveHoursAt60Kmh_est: 1.05,
      driveHoursAt100Kmh_est: 0.63,
      acChargeFrom10PercentToThisSocMinutes_est: 0.0,
      acChargeFrom10PercentToThisSocHours_est: 0.0,
      dcFastChargeFrom10PercentToThisSocMinutes_est: 0.0
    },
    {
      socPercent: 20,
      batteryEnergyKWh_est: 23.6,
      remainingRangeKm_est: 125.5,
      remainingRangeMiles_est: 78.0,
      driveHoursAt60Kmh_est: 2.09,
      driveHoursAt100Kmh_est: 1.26,
      acChargeFrom10PercentToThisSocMinutes_est: 93.3,
      acChargeFrom10PercentToThisSocHours_est: 1.56,
      dcFastChargeFrom10PercentToThisSocMinutes_est: 4.4
    },
    {
      socPercent: 30,
      batteryEnergyKWh_est: 35.4,
      remainingRangeKm_est: 188.3,
      remainingRangeMiles_est: 117.0,
      driveHoursAt60Kmh_est: 3.14,
      driveHoursAt100Kmh_est: 1.88,
      acChargeFrom10PercentToThisSocMinutes_est: 186.7,
      acChargeFrom10PercentToThisSocHours_est: 3.11,
      dcFastChargeFrom10PercentToThisSocMinutes_est: 8.9
    },
    {
      socPercent: 40,
      batteryEnergyKWh_est: 47.2,
      remainingRangeKm_est: 251.1,
      remainingRangeMiles_est: 156.0,
      driveHoursAt60Kmh_est: 4.18,
      driveHoursAt100Kmh_est: 2.51,
      acChargeFrom10PercentToThisSocMinutes_est: 280.0,
      acChargeFrom10PercentToThisSocHours_est: 4.67,
      dcFastChargeFrom10PercentToThisSocMinutes_est: 13.3
    },
    {
      socPercent: 50,
      batteryEnergyKWh_est: 59.0,
      remainingRangeKm_est: 313.8,
      remainingRangeMiles_est: 195.0,
      driveHoursAt60Kmh_est: 5.23,
      driveHoursAt100Kmh_est: 3.14,
      acChargeFrom10PercentToThisSocMinutes_est: 373.3,
      acChargeFrom10PercentToThisSocHours_est: 6.22,
      dcFastChargeFrom10PercentToThisSocMinutes_est: 17.7
    },
    {
      socPercent: 60,
      batteryEnergyKWh_est: 70.8,
      remainingRangeKm_est: 376.6,
      remainingRangeMiles_est: 234.0,
      driveHoursAt60Kmh_est: 6.28,
      driveHoursAt100Kmh_est: 3.77,
      acChargeFrom10PercentToThisSocMinutes_est: 466.7,
      acChargeFrom10PercentToThisSocHours_est: 7.78,
      dcFastChargeFrom10PercentToThisSocMinutes_est: 22.1
    },
    {
      socPercent: 70,
      batteryEnergyKWh_est: 82.6,
      remainingRangeKm_est: 439.4,
      remainingRangeMiles_est: 273.0,
      driveHoursAt60Kmh_est: 7.32,
      driveHoursAt100Kmh_est: 4.39,
      acChargeFrom10PercentToThisSocMinutes_est: 560.0,
      acChargeFrom10PercentToThisSocHours_est: 9.33,
      dcFastChargeFrom10PercentToThisSocMinutes_est: 26.6
    },
    {
      socPercent: 80,
      batteryEnergyKWh_est: 94.4,
      remainingRangeKm_est: 502.1,
      remainingRangeMiles_est: 312.0,
      driveHoursAt60Kmh_est: 8.37,
      driveHoursAt100Kmh_est: 5.02,
      acChargeFrom10PercentToThisSocMinutes_est: 653.3,
      acChargeFrom10PercentToThisSocHours_est: 10.89,
      dcFastChargeFrom10PercentToThisSocMinutes_est: 31.0
    },
    {
      socPercent: 90,
      batteryEnergyKWh_est: 106.2,
      remainingRangeKm_est: 564.9,
      remainingRangeMiles_est: 351.0,
      driveHoursAt60Kmh_est: 9.41,
      driveHoursAt100Kmh_est: 5.65,
      acChargeFrom10PercentToThisSocMinutes_est: 746.7,
      acChargeFrom10PercentToThisSocHours_est: 12.44,
      dcFastChargeFrom10PercentToThisSocMinutes_est: null
    },
    {
      socPercent: 100,
      batteryEnergyKWh_est: 118.0,
      remainingRangeKm_est: 627.6,
      remainingRangeMiles_est: 390.0,
      driveHoursAt60Kmh_est: 10.46,
      driveHoursAt100Kmh_est: 6.28,
      acChargeFrom10PercentToThisSocMinutes_est: 840.0,
      acChargeFrom10PercentToThisSocHours_est: 14.0,
      dcFastChargeFrom10PercentToThisSocMinutes_est: null
    }
  ]
};

export const mercedesEqsDerivedValues = {
  rangePer1PercentKm: 6.28,
  rangePer1PercentMiles: 3.9,
  batteryEnergyPer1PercentKWh: 1.18,

  acCharging: {
    powerWatt: 9600,
    averageMinutesPer1Percent_from10To100: 9.33,
    averageHoursPer10Percent: 1.56
  },

  dcFastCharging: {
    powerWatt: 200000,
    averageMinutesPer1Percent_from10To80: 0.44,
    averageMinutesPer10Percent_from10To80: 4.43,
    note: "Only use this from 10% to 80%. Do not estimate 90% or 100% using the same speed because DC charging slows down after 80%."
  }
};

export const mercedesEqsAiTrainingRules = {
  estimatedRangeKm: "batteryPercent * 6.276",
  estimatedRangeMiles: "batteryPercent * 3.9",
  estimatedBatteryEnergyKWh: "batteryPercent * 1.18",
  acMinutesNeeded: "(targetPercent - currentPercent) * 9.33",
  dcMinutesNeeded: "(targetPercent - currentPercent) * 0.443",
  dcFastChargingValidSocRange: {
    minPercent: 10,
    maxPercent: 80
  }
};
