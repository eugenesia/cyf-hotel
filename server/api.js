const express = require('express');
const router = express.Router();
const filename = './database/database.sqlite';
const sqlite3    = require( 'sqlite3' ).verbose();

// Utility functions
function isValidDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function formatJSDate(date) {
  let dateObj = new Date(date);
  return `${dateObj.getFullYear()}-${('0' + (dateObj.getMonth() + 1)).slice(-2)}-${('0' + dateObj.getDate()).slice(-2)}`;
}

function getJSDate(date) {
  return Date.parse(date);
}

function isValidateInvoice(invoice) {
  if (Number.isNaN(invoice.total)) return false;
  if (Number.isNaN(invoice.surcharges)) return false;
  if (!isValidDate(invoice.invoiceDate)) return false;
  if (invoice.paid.toLowerCase() !== 'true' &&  invoice.paid.toLowerCase() !== 'false') return false;
  return true;
}

// open the database
let db = new sqlite3.Database(filename);
  
router.get('/customers', function(req, res) {

  db.serialize(function() {

    var sql = 'select * from customers';

    db.all(sql, [],(err, rows ) => {
      if (err) {
        console.log(err);
        return res.status(500).json({error: `Failed to retrive customer data: ${err.message}`});
      }
      res.status(200).json({
        customers: rows
      });  
    });
  }); 

});

router.post('/customers', function(req, res) {
  let customer = req.body.customer;
  
  db.serialize(function() {
    let sql = `INSERT INTO customers (title, firstname, surname, email) VALUES (?, ?, ?, ?)`;

    db.run(sql, [customer.title, customer.firstname, customer.surname, customer.email], function(err, rows ) {
      if (err) {
        console.log(err);
        return res.status(500).json({error: `Failed to save customer data: ${err.message}`});
      }
      res.status(200).json({
        customers: rows
      });  
    });
  }); 
});

router.get('/room-types', function(req, res) {

  db.serialize(function() {
    var sql = `SELECT id, type_name AS name, original_price, current_price FROM room_types ORDER BY current_price ASC`;

    db.all(sql, [], function(err, rows ) {
      if (err) {
        console.log(err);
        return res.status(500).json({error: `Failed to retrive rooms data: ${err.message}`});
      }
      res.status(200).json({
        roomtypes: rows
      });  
    });
  }); 
});

router.put('/discount', function(req, res) {
  let discount = parseFloat( req.body.discount );
  let roomId = parseFloat(req.query.id);

  if (Number.isNaN(discount)) 
    return res.status(400).json({error: 'Invalid input, discount accepts numbers'});

  if (Number.isNaN(roomId)) 
    return res.status(400).json({error: 'Invalid input, id accepts numbers'});

  let reductionFactor = 1-(req.body.discount / 100);
  let fetchPriceSql = `SELECT original_price FROM room_types WHERE id = ${roomId}`;
  let postPriceSql = `UPDATE room_types SET current_price = round((${fetchPriceSql}) * ${reductionFactor}) WHERE id = ${roomId}`;

  db.serialize(function() {
    db.run(postPriceSql, [], function(err, data ) {
      if (err) {
        console.log(err);
        return res.status(500).json({error: `Failed to update room data: ${err.message}`}); 
      }
      if (this.changes === 0) 
        return res.status(400).json({error: 'Invalid room id, no records have been updated'});
      res.status(200).json({
        id: roomId,
        discount: discount
      });  
    });
  });

});

router.post('/reservations', function(req, res) {
  let nightPrice;
  let customerId = req.body.reservation.customerId;
  let roomId = req.body.reservation.roomId;
  let checkInDateString = req.body.reservation.checkInDate;
  let checkOutDateString =req.body.reservation.checkOutDate;

  // this validation should be moved to a utility function
  if (!isValidDate(checkInDateString) || !isValidDate(checkOutDateString )) 
    return res.status(400).json({error: 'invalid date format. Accepts: YYYY-MM-DD'});

  if(!/^\d{1,}$/.test(customerId))
    return res.status(400).json({error: 'invalid customerId, accepts numbers'});

  if(!/^\d{1,}$/.test(roomId))
    return res.status(400).json({error: 'invalid roomId, accepts numbers'});

  let checkInDate = getJSDate(checkInDateString);
  let checkOutDate = getJSDate(checkOutDateString);
  let currentDate = new Date().setHours(0, 0, 0, 0);

  if (checkInDate < currentDate || checkInDate > checkOutDate) 
    return res.status(400).json({error: 'invalid bookign dates'});

  console.log(checkInDate + ' ===== ' + checkOutDate);

  db.serialize(function() {

    let fetchPriceSql = `SELECT room_types.current_price AS price FROM rooms INNER JOIN room_types ON room_types.id = rooms.room_type_id  WHERE rooms.id = ${roomId}`;
    db.all(fetchPriceSql, [], function(err, fetchPriceRows ) {
      if (err) {
        console.log(err)
        return res.status(500).json({reservation: {error: `Fialed to retrive night cost ${err.message}`}});
      }
      if (fetchPriceRows.length < 1) 
        return res.status(400).json({error: 'roonId does not exist'});

      nightPrice = fetchPriceRows[0].price;

      let checkExistingReservationsSql = `SELECT room_id, check_in_date, check_out_date FROM reservations WHERE room_id = ${roomId} AND (${checkInDate} BETWEEN check_in_date AND check_out_date OR ${checkOutDate} BETWEEN check_in_date AND check_out_date OR check_in_date BETWEEN ${checkInDate} AND ${checkOutDate})`;

      console.log(checkExistingReservationsSql);

      db.all(checkExistingReservationsSql, [], function(err, fetchExistingBookingRows) {
        if (err) {
          console.log(err)
          return res.status(500).json({reservation: {error: `Failed to retrive existing booking data: ${err.message}`}});
        }
        if (fetchExistingBookingRows.length > 0) 
          return res.status(400).json({reservation: {error: 'room booked for all or some of these dates'}});

        let postReservationSql = `INSERT INTO reservations (customer_id, room_id, check_in_date, check_out_date, room_price) VALUES (?, ?, ?, ?, ?)`;

        fullPrice = Math.ceil((checkOutDate - checkInDate) / (24 * 3600000)) * nightPrice;

        db.run(postReservationSql, [customerId, roomId, checkInDate, checkOutDate, fullPrice], function(err, postedRows) {
          if (err) {
            console.log(err);
            return res.status(500).json({reservation: {error: `Failed to set reservsation: ${err.message}`}});
          }
          if (this.changes === 0) 
            return res.status(500).json({reservation: {error: 'Data not posted, no records have been added'}});
          res.status(200).json({
            reservation: postedRows
          });
        });
      });
    });
  });

});

router.get('/reservations', function(req, res) {
  res.header("Access-Control-Allow-Origin", "*");

  let condition = '';
  condition += (req.query.id) ? `customer_id = ${req.query.id}` : '';
  condition += (req.query.name) ? `firstname LIKE \'%${req.query.name}%\'` : '';
  if (condition.length > 0) condition = 'WHERE ' + condition;

  let reservationQuerySql = `SELECT reservations.id AS id, title, firstname AS firstName, surname, email, room_id AS roomId, check_in_date AS checkInDate, check_out_date AS checkOutDate FROM reservations INNER JOIN customers ON customers.id = reservations.customer_id ${condition}`;

  db.serialize(function() {
    db.all(reservationQuerySql, [], (err, rows) => {
      if (err) {
        console.log(err);
        return res.status(500).json({error: 'Failed to retrive reservation data'});
      }
      let rowsReadable = rows.map(row => {
        row.checkInDate = formatJSDate(row.checkInDate);
        row.checkOutDate = formatJSDate(row.checkOutDate);
        return row;
      });
      setTimeout(() => {
        res.status(200).json({ reservations: rowsReadable});
      }, 1000);
    });
  });
});

router.get('/reservations/date-from/:dateFrom', function(req, res) {
  let dateFrom = req.params.dateFrom;
  if (!isValidDate(dateFrom)) 
    return res.status(400).json({error: 'invalid date format: accepts YYYY-MM-DD'});

  let checkInDate = Date.parse(dateFrom);
  let endDate = checkInDate + 30 * 24 * 3600000;

  let condition = `check_in_date BETWEEN \'${checkInDate}\' AND \'${endDate}\'`;

  let reservationsQuerySql = `SELECT title, firstname, surname, email, room_id AS roomId, check_in_date AS checkInDate, check_out_date AS checkOutDate FROM reservations INNER JOIN customers ON customers.id = reservations.customer_id WHERE ${condition} ORDER BY check_in_date ASC`;

  db.serialize(function() {
    db.all(reservationsQuerySql, [], function(err, rows) {
      if (err) {
        console.log(err);
        return res.status(500).json({ error: `Failed to retrive booking data: ${err.message}`});
      }
      let rowsReadable = rows.map(row => {
        row.checkInDate = formatJSDate(row.checkInDate);
        row.checkOutDate = formatJSDate(row.checkOutDate);
        return row;
      });
      res.status(200).json({
        reservations: rows
      });
    });
  });

});

router.put('/invoice', function(req, res) {
  let reservationId = req.query.reservationId;
  let invoice = req.body.invoice;

  if (Number.isNaN(parseFloat(reservationId))) 
    return res.status(400).json({error: 'Invalid reservationId: accepts numbers'});

  if (!isValidateInvoice(invoice)) 
    return res.status(400).json({error: 'Invalid invlice data: accepts numbers except for paid boolean'});

  invoice.invoiceDate = getJSDate(invoice.invoiceDate);
  invoice.paid = (invoice.paid.toLowerCase() === 'true');

  db.serialize(function() {
    postInvoiceSql = `INSERT INTO invoices (reservation_id, total, surcharges, invoice_date_time, paid) VALUES (?, ?, ?, ?, ?)`;
    db.run(postInvoiceSql, [reservationId, invoice.total, invoice.surcharges, invoice.invoiceDate, invoice.paid], function(err, rows) {
      if (err) {
        console.log(err);
        return res.status(500).json({ error: `Failed to save invoice details ${err.message}`});
      }
      if (this.changes === 0) 
        return res.status(500).json({invoice: {error: 'Data not posted, no records have been added'}});
      res.status(200).json({
        reservationId: req.query.reservationId,
        invoice: req.body.invoice
      });
    });
  });
});

router.post('/reviews', function(req, res) {
  let review = req.body.review;
  review.reviewDate = getJSDate(review.reviewDate);

  let postReviewSql = `INSERT INTO reviews (customer_id, room_type_id, rating, comment, review_date) VALUES (?, ?, ?, ?, ?)`;

  db.serialize(function() {
    db.run(postReviewSql, [review.customerId, review.roomTypeId, review.rating, review.comment, review.reviewDate], function(err, rows) {
      if (err) {
        console.log(err);
        return res.status(500).json({ error: `Failed to save reviw details ${err.message}`});
      }
      if (this.changes === 0) 
        return res.status(500).json({invoice: {error: 'Data not posted, no records have been added'}});
      res.status(200).json(req.body);
    });
  });

});

module.exports = router;
