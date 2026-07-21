import User from "../models/User.js";

export function isVipActive(user, now = new Date()) {
  if (!user) return false;

  // Nếu có vipUntil thì VIP chỉ còn hiệu lực khi vipUntil > hiện tại
  if (user.vipUntil) {
    const until = new Date(user.vipUntil);
    return !Number.isNaN(until.getTime()) && until > now;
  }

  // vipUntil = null thì coi như VIP thủ công/vĩnh viễn
  return Boolean(user.isVip);
}

export async function expireVipIfNeeded(userDoc, now = new Date()) {
  if (!userDoc) return null;

  const expired =
    userDoc.isVip === true &&
    userDoc.vipUntil &&
    new Date(userDoc.vipUntil) <= now;

  if (expired) {
    userDoc.isVip = false;
    await userDoc.save();
  }

  return userDoc;
}

export function toVipResponse(user) {
  return {
    isVip: isVipActive(user),
    vipUntil: user?.vipUntil || null,
  };
}

export async function expireAllExpiredVip(now = new Date()) {
  return User.updateMany(
    {
      isVip: true,
      vipUntil: { $ne: null, $lte: now },
    },
    {
      $set: { isVip: false },
    }
  );
}