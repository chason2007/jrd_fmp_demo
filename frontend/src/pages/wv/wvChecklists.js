export const WV_CHECKLISTS = {
  standard: {
    name: 'Room Hygiene',
    items: [
      'Main door and door frames in good condition',
      'Ceiling lights and smoke detector working',
      'Floor free from dust and in clean condition',
      'Pest resistance (no sign of insects/rodents)'
    ]
  },
  bathroom: {
    name: 'Bathroom Hygiene',
    items: [
      'Faucets working and in good condition',
      'Exhaust, wash basin and mirror in good condition',
      'Floor tiles clean, free from damages',
      'Clean/condition overall, free from mold'
    ]
  },
  furniture: {
    name: 'Furniture & Appliances',
    items: [
      'Curtains, Windows, Bed base & Mattress clean',
      'Wardrobe clean, in good condition',
      'Appliances in working condition',
      'Fire Alarms present & operational'
    ]
  },
  corridor: {
    name: 'Corridor',
    items: [
      'Corridor free from pest',
      'Dustbins cleaned and closed',
      'Corridor clean and free from obstacles',
      'Fire hose in good condition',
      'Fire emergency board placed'
    ]
  },
  stairways: {
    name: 'Stairways',
    items: [
      'Railings secure and free from looseness',
      'Steps non-slip and safe to use',
      'Stairs clean and free from sharp edges',
      'Emergency lighting visible and functioning'
    ]
  },
  gym: {
    name: 'Gym Facility',
    items: [
      'All equipment in good condition',
      'Lights and AC/Ventilation in good condition',
      'Floor clean, hygienic & free from damages'
    ]
  },
  recreation: {
    name: 'Recreation Facilities',
    items: [
      'All indoor games equipment in good condition',
      'Lighting in good condition',
      'Floor clean, free from damages',
      'Ground in good condition'
    ]
  }
};

export function getChecklist(auditType, roomSelection) {
  if (auditType === 'gym') return [WV_CHECKLISTS.gym];
  if (auditType === 'recreation') return [WV_CHECKLISTS.recreation];
  if (roomSelection === 'Corridor') return [WV_CHECKLISTS.corridor];
  if (roomSelection === 'Stairways') return [WV_CHECKLISTS.stairways];
  return [WV_CHECKLISTS.standard, WV_CHECKLISTS.bathroom, WV_CHECKLISTS.furniture];
}
