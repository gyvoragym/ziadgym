/** Account banning stays separate from the durable gym access revocation. */
export async function deactivateDedicatedOwner(
  target: { ownerId: string; disableOwner: boolean },
  update: (id: string, attributes: { ban_duration: string }) => Promise<{ error: unknown }>,
) {
  if (!target.disableOwner) return;
  const { error } = await update(target.ownerId, { ban_duration: '876000h' });
  if (error) throw new Error('Gym access is disabled, but owner sign-in deactivation failed. Retry Delete to complete it.');
}