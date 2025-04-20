"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrainingGoal = exports.GenderType = exports.AttendanceType = exports.PaymentStatus = exports.MemberStatus = exports.MembershipType = void 0;
// src/types/index.ts
var MembershipType;
(function (MembershipType) {
    MembershipType["MONTHLY"] = "MONTHLY";
    MembershipType["QUARTERLY"] = "QUARTERLY";
    MembershipType["ANNUAL"] = "ANNUAL";
    MembershipType["DAILY_PASS"] = "DAILY_PASS";
})(MembershipType || (exports.MembershipType = MembershipType = {}));
var MemberStatus;
(function (MemberStatus) {
    MemberStatus["ACTIVE"] = "ACTIVE";
    MemberStatus["INACTIVE"] = "INACTIVE";
    MemberStatus["FROZEN"] = "FROZEN";
    MemberStatus["EXPIRED"] = "EXPIRED";
})(MemberStatus || (exports.MemberStatus = MemberStatus = {}));
var PaymentStatus;
(function (PaymentStatus) {
    PaymentStatus["PENDING"] = "PENDING";
    PaymentStatus["PAID"] = "PAID";
    PaymentStatus["OVERDUE"] = "OVERDUE";
    PaymentStatus["REFUNDED"] = "REFUNDED";
    PaymentStatus["CANCELLED"] = "CANCELLED";
})(PaymentStatus || (exports.PaymentStatus = PaymentStatus = {}));
var AttendanceType;
(function (AttendanceType) {
    AttendanceType["CHECK_IN"] = "CHECK_IN";
    AttendanceType["CHECK_OUT"] = "CHECK_OUT";
})(AttendanceType || (exports.AttendanceType = AttendanceType = {}));
var GenderType;
(function (GenderType) {
    GenderType["MALE"] = "MALE";
    GenderType["FEMALE"] = "FEMALE";
    GenderType["OTHER"] = "OTHER";
})(GenderType || (exports.GenderType = GenderType = {}));
var TrainingGoal;
(function (TrainingGoal) {
    TrainingGoal["STRENGTH"] = "STRENGTH";
    TrainingGoal["CARDIO"] = "CARDIO";
    TrainingGoal["WEIGHT_LOSS"] = "WEIGHT_LOSS";
    TrainingGoal["MUSCLE_GAIN"] = "MUSCLE_GAIN";
    TrainingGoal["GENERAL_FITNESS"] = "GENERAL_FITNESS";
})(TrainingGoal || (exports.TrainingGoal = TrainingGoal = {}));
