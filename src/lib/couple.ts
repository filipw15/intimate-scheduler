import { prisma } from "@/lib/prisma";

/**
 * Hittar ett par som användaren tillhör och som ännu inte är upplöst
 * (status pending eller active). Används för att validera att man inte
 * kan tillhöra mer än ett aktivt par åt gången.
 */
export async function findCurrentCouple(userId: string) {
  return prisma.couple.findFirst({
    where: {
      OR: [{ user_a_id: userId }, { user_b_id: userId }],
      status: { in: ["pending", "active"] },
    },
  });
}
