// back-end/utils/softDeletePlugin.js
// Mặc định mọi query sẽ ẩn bản ghi có isDelete=true.

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);

export function softDeletePlugin(schema) {
  // Chỉ dùng nội bộ cho các kiểm tra ràng buộc/unique.
  // Không expose query này qua API admin nên admin không có quyền khôi phục.
  schema.query.withDeleted = function withDeleted() {
    this._includeSoftDeleted = true;
    return this;
  };

  function excludeDeleted() {
    if (this._includeSoftDeleted === true) return;

    const filter = this.getFilter?.() || {};
    if (!hasOwn(filter, "isDelete")) {
      this.where({ isDelete: { $ne: true } });
    }
  }

  [
    "find",
    "findOne",
    "countDocuments",
    "findOneAndUpdate",
    "updateOne",
    "updateMany",
    "deleteOne",
    "deleteMany",
  ].forEach((operation) => {
    schema.pre(operation, excludeDeleted);
  });

  schema.pre("aggregate", function excludeDeletedFromAggregate() {
    const pipeline = this.pipeline();
    const alreadyHandlesIsDelete = pipeline.some(
      (stage) => stage?.$match && hasOwn(stage.$match, "isDelete")
    );
    if (alreadyHandlesIsDelete) return;

    const softDeleteMatch = { $match: { isDelete: { $ne: true } } };
    const mustStayFirst = pipeline[0]?.$geoNear || pipeline[0]?.$search;

    if (mustStayFirst) pipeline.splice(1, 0, softDeleteMatch);
    else pipeline.unshift(softDeleteMatch);
  });
}
