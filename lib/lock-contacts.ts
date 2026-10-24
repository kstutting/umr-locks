export type LockContact = {
  channel: number;
  /** Display form, for example (612) 724-2971. */
  phone: string;
  /** Digits for a tel: link, including country code. */
  tel: string;
};

/**
 * VHF call channel and lock phone.
 * Channels and phones for locks outside Rock Island's list are from the
 * St. Louis District locking-through guide. Locks 11–22 use the Rock Island
 * District phone list, which changes Lock 14 to (309) 794-4357.
 */
const CONTACTS: Record<string, LockContact> = {
  "1": contact(14, "6127242971"),
  "2": contact(14, "6514373150"),
  "3": contact(14, "6513885794"),
  "4": contact(14, "6086854421"),
  "5": contact(14, "5076892101"),
  "5A": contact(14, "5074522789"),
  "6": contact(14, "6085346774"),
  "7": contact(14, "5078952170"),
  "8": contact(14, "6086892625"),
  "9": contact(14, "6088744311"),
  "10": contact(14, "5632521261"),
  "11": contact(14, "5635821204"),
  "12": contact(14, "5638723314"),
  "13": contact(14, "8155893313"),
  "14": contact(14, "3097944357"),
  "15": contact(14, "3097945266"),
  "16": contact(14, "3095373191"),
  "17": contact(14, "3095878125"),
  "18": contact(14, "3098732246"),
  "19": contact(14, "3195242631"),
  "20": contact(14, "5732883320"),
  "21": contact(14, "2172220918"),
  "22": contact(14, "5732210294"),
  "24": contact(14, "5732423524"),
  "25": contact(12, "6365668120"),
  "26": contact(14, "6184621713"),
};

function contact(channel: number, digits: string): LockContact {
  return {
    channel,
    phone: `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`,
    tel: `+1${digits}`,
  };
}

export function lockContact(displayNumber: string): LockContact | null {
  return CONTACTS[displayNumber.toUpperCase()] ?? null;
}
