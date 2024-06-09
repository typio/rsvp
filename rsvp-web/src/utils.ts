export const h12To24 = (hour: number, isAM: boolean) => hour + (isAM ? 0 : 12)
export const h24To12 = (hour: number): { hour: string; isAM: boolean } => {
  return { hour: '' + (hour > 12 ? hour - 12 : hour), isAM: hour < 12 }
}

export const h24ToTimeRange = (timeRange: {
  from_hour: number
  to_hour: number
}) => {
  return {
    from: h24To12(timeRange.from_hour),
    to: h24To12(timeRange.to_hour)
  }
}
