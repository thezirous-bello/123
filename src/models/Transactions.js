// import { createRealmContext, Realm } from "@realm/react";

// // export class Transactions extends Realm.Object {
// export class Transactions extends Realm.Object {
//   constructor({
//     _id = new Realm.BSON.ObjectID(),
//     image,
//     name,
//     priceBought,
//     quantityBought,
//     ticker,
//     timestamp,
//     transaction_type,
//     user_id,
//   }) {
//     super();
//     (this._id = _id),
//       (this.image = image),
//       (this.name = name),
//       (this.priceBought = priceBought),
//       (this.quantityBought = quantityBought),
//       (this.ticker = ticker),
//       (this.timestamp = timestamp),
//       (this.transaction_type = transaction_type),
//       (this.user_id = user_id);
//   }

//   static schema = {
//     name: "Transaction",
//     properties: {
//       _id: "objectId",
//       image: "string?",
//       name: "string?",
//       priceBought: "double?",
//       quantityBought: "double?",
//       ticker: "string?",
//       timestamp: "string?",
//       transaction_type: "string?",
//       user_id: "string?",
//     },
//     primaryKey: "_id",
//   };
// }

// export const { useRealm, useQuery, RealmProvider } = createRealmContext({
//   schema: [Transactions.schema],
//   deleteRealmIfMigrationNeeded: true,
// });
// Define your object model

// import Realm from "realm";

// export const TransactionSchema = {
//   name: "Transaction",
//   properties: {
//     _id: "objectId",
//     image: "string?",
//     name: "string?",
//     priceBought: "double?",
//     quantityBought: "double?",
//     ticker: "string?",
//     timestamp: "string?",
//     transaction_type: "string?",
//     user_id: "string?",
//   },
//   primaryKey: "_id",
// };
