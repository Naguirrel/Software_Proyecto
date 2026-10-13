function orderNotifications(notifications) {
  return [...notifications].sort((left, right) => {
    const dateDifference = new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    return dateDifference || Number(right.id) - Number(left.id);
  });
}

export function mergeNotification(current, incoming) {
  if (!incoming?.id) return current;
  return orderNotifications([incoming, ...current.filter((item) => item.id !== incoming.id)]);
}

export { orderNotifications };
