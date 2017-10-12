const express = require('express');
const router = express.Router();
const filename = './database/database.sqlite';
const sqlite3    = require( 'sqlite3' ).verbose();



// open the database
let db = new sqlite3.Database(filename);
  
router.get('/customers', function(req, res) {

  db.serialize(function() {

    var sql = 'select * from customers';

    db.all(sql, [],(err, rows ) => {
      if (err) {
        console.log(err);
        res.status(500).json({error: 'Failed to retrive customer data'});
        return;
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

    db.run(sql, [customer.title, customer.firstname, customer.surname, customer.email], (err, rows ) => {
      if (err) {
        console.log(err);
        res.status(500).json({error: 'Failed to save customer data'});
        return;
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

    db.all(sql, [], (err, rows ) => {
      if (err) {
        console.log(err);
        res.status(500).json({error: 'Failed to retrive rooms data'});
        return;
      }
      res.status(200).json({
        roomtypes: rows
      });  
    });
  }); 
});

router.put('/discount', function(req, res) {
  let reductionFactor = 1-(req.body.discount / 100);
  let fetchPriceSql = `SELECT original_price FROM room_types WHERE id = ${req.query.id}`;
  let postPriceSql = `UPDATE room_types SET current_price = round((${fetchPriceSql}) * ${reductionFactor}) WHERE id = ${req.query.id}`;

  db.serialize(function() {
    db.run(postPriceSql, [], (err, data ) => {
      if (err) {
      console.log(err);
      res.status(500).json({error: 'Failed to update room data'});
      return;
    }
      res.status(200).json({
        id: req.query.id,
        discount: req.body.discount
      });  
    });
  });

  /*
  db.serialize(function() {
    let fetchSql = `SELECT original_price FROM room_types WHERE id = ${req.query.id}`;
    db.all(fetchSql, [], (err, rows ) => {
      if (err) {
        console.log(err);
        res.status(500).json({error: 'Failed to retrive rooms data'});
        return;
      }
      originalPrice = rows[0].original_price;

      let postSql = `UPDATE room_types SET current_price = ${Math.round((1-(req.body.discount /100)) * original_price)} WHERE id = ${req.query.id}`;

      db.run(postSql, [], (err, data ) => {
        if (err) {
        console.log(err);
        res.status(500).json({error: 'Failed to update room data'});
        return;
      }
        res.status(200).json({
          id: req.query.id,
          discount: req.body.discount
        });  
      });
    });
  }); */
});

router.post('/reservations', function(req, res) {
  let nightPrice, fullPrice;
  if (!(/^\d{4}-\d{2}-\d{2}$/.test(req.body.reservation.checkInDate)) ||
      !(/^\d{4}-\d{2}-\d{2}$/.test(req.body.reservation.checkOutDate)) )
    return res.status(500).jason({error: 'invalid dates'});
  let checkInDate = new Date(Date.parse(req.body.reservation.checkInDate) + 14 * 3600000);
  let checkOutDate = new Date(Date.parse(req.body.reservation.checkOutDate) + 12 * 3600000);
  if (checkOutDate <= checkInDate || checkInDate < (new Date() + 10 * 3600000 - 1) ) return res.status(500).json({reservation: {error: 'Invalid dates'}});
  let checkInDateString = `${checkInDate.getFullYear()}-${('0' + (checkInDate.getMonth() + 1)).slice(-2)}-${('0' + checkInDate.getDate()).slice(-2)} ${('0' + checkInDate.getHours()).slice(-2)}:${('0' + checkInDate.getMinutes()).slice(-2)}:${('0' + checkInDate.getSeconds()).slice(-2)}`;
  let checkOutDateString = `${checkOutDate.getFullYear()}-${('0' + (checkOutDate.getMonth() + 1)).slice(-2)}-${('0' + checkOutDate.getDate()).slice(-2)} ${('0' + checkOutDate.getHours()).slice(-2)}:${('0' + checkOutDate.getMinutes()).slice(-2)}:${('0' + checkOutDate.getSeconds()).slice(-2)}`;
  let roomId = req.body.reservation.roomId;
  let customerId = req.body.reservation.customerId;
  db.serialize(function() {
    let fetchPriceSql = `SELECT room_types.current_price AS price FROM rooms INNER JOIN room_types ON room_types.id = rooms.room_type_id  WHERE rooms.id = ${roomId}`;
    
    db.all(fetchPriceSql, [], (err, rows ) => {
      if (err) return res.status(500).json({reservation: {error: 'Fialed to retrive night cost'}});
      nightPrice = rows[0].price;

      let checkExistingReservationsSql = `SELECT room_id, check_in_date, check_out_date FROM reservations WHERE room_id = ${roomId}`;

      db.all(checkExistingReservationsSql, [], (err, rows) => {
        if (err) return res.status(500).json({reservation: {error: 'Failed to retrive existing booking data'}});
        let bookingConflict = rows.filter(row => {
          let existingCheckInDate = Date.parse(row.check_in_date);
          let existingCheckOutDate = Date.parse(row.check_out_date);
          return ((checkInDate >= existingCheckInDate && checkInDate <= existingCheckOutDate) ||
           (checkOutDate >= existingCheckInDate && checkOutDate <= existingCheckOutDate) ||
           (checkInDate <= existingCheckInDate && checkOutDate >= existingCheckOutDate))
        }).length;
        if (bookingConflict > 0) return res.status(500).json({reservation: {error: 'room booked for all or some of these dates'}});

        let postReservationSql = `INSERT INTO reservations (customer_id, room_id, check_in_date, check_out_date, room_price) VALUES (?, ?, ?, ?, ?)`;

        fullPrice = Math.ceil((checkOutDate - checkInDate) / (24 * 3600000)) * nightPrice;

         db.run(postReservationSql, [customerId, roomId, checkInDateString, checkOutDateString, fullPrice], (err, rows) => {
          if (err) {
            console.log(err);
            return res.status(500).json({reservation: {error: 'Failed to set reservsation'}});
          }

          res.status(200).json({
            reservation: rows
          });
         });
      });



      // let postSql = `UPDATE room_types SET current_price = ${Math.round((1-(req.body.discount /100)) * original_price)} WHERE id = ${req.query.id}`;

      /*db.run(postSql, [], (err, data ) => {
        if (err) console.log(err);
        res.status(200).json({
          id: req.query.id,
          discount: req.body.discount
        });  
      });*/
    });
  }); 
});

router.get('/reservations', function(req, res) {
  let condition = (req.query.id) ? `customer_id = ${req.query.id}` : `firstname = \'${req.query.name}\'`;
  let reservationQuerySql = `SELECT title, firstname, surname, email, room_id AS roomId, check_in_date AS checkInDate, check_out_date AS checkOutDate FROM reservations INNER JOIN customers ON customers.id = reservations.customer_id WHERE ${condition}`;

  db.serialize(function() {
    db.all(reservationQuerySql, [], (err, rows) => {
      if (err) {
        console.log(err);
        res.status(500).json({error: 'Failed to retrive reservation data'});
        return;
      }
      res.status(200).json({ reservations: rows});
    });
  });
});

router.get('/reservations/date-from/:dateFrom', function(req, res) {
  if (!(/^\d{4}-\d{2}-\d{2}$/.test(req.params.dateFrom))) return res.status(500).jason({error: 'invalid date'});
  let checkInDate = new Date(req.params.dateFrom);
  let endDate = new Date(Date.parse(req.params.dateFrom) + 30 * 24 * 3600000);
  let checkInDateString = `${checkInDate.getFullYear()}-${('0' + (checkInDate.getMonth() + 1)).slice(-2)}-${('0' + checkInDate.getDate()).slice(-2)} ${('0' + checkInDate.getHours()).slice(-2)}:${('0' + checkInDate.getMinutes()).slice(-2)}:${('0' + checkInDate.getSeconds()).slice(-2)}`;
  let endDateString = `${endDate.getFullYear()}-${('0' + (endDate.getMonth() + 1)).slice(-2)}-${('0' + endDate.getDate()).slice(-2)} ${('0' + endDate.getHours()).slice(-2)}:${('0' + endDate.getMinutes()).slice(-2)}:${('0' + endDate.getSeconds()).slice(-2)}`;
  let condition = `check_in_date BETWEEN \'${checkInDateString}\' AND \'${endDateString}\'`;
  let reservationsQuerySql = `SELECT title, firstname, surname, email, room_id AS roomId, check_in_date AS checkInDate, check_out_date AS checkOutDate FROM reservations INNER JOIN customers ON customers.id = reservations.customer_id WHERE ${condition} ORDER BY check_in_date ASC`;

  console.log(reservationsQuerySql);

  db.serialize(function() {
    db.all(reservationsQuerySql, [], (err, rows) => {
      if (err) {
        console.log(err);
        res.status(500).json({ error: 'Failed to retrive booking data'});
        return;
      }
      let rowsHumanReadable = rows.map(row => {
        let checkInDate = new Date(row.checkInDate);
        let checkOutDate = new Date(row.checkOutDate);
        return {
          title: row.title,
          firstname: row.firstname,
          surname: row.surname,
          email: row.email,
          roomId: row.roomId,
          checkInDate: `${checkInDate.getFullYear()}-${checkInDate.getMonth() + 1}-${checkInDate.getDate()}`,
          checkOutDate: `${checkOutDate.getFullYear()}-${checkOutDate.getMonth() + 1}-${checkOutDate.getDate()}`
        }; 
      });
      res.status(200).json({
        reservations: rows
      });
    });
  });
  // TODO read req.params.dateFrom to look up reservations and return
/*  res.status(200).json({
    reservations:[{
      title: 'Mr',
      firstname: 'Laurie',
      surname: 'Ainley',
      email: 'laurie@ainley.com',
      roomId: 1,
      checkInDate: '2017-10-10',
      checkOutDate: '2017-10-17'
    }, {
      title: 'Miss',
      firstname: 'Someone',
      surname: 'Else',
      email: 'someone@else.com',
      roomId: 2,
      checkInDate: '2017-11-12',
      checkOutDate: '2017-11-15'
    }]
  });*/
});

router.put('/invoice', function(req, res) {
  let reservationId = req.query.reservationId;
  let invoice = req.body.invoice;

  db.serialize(function() {
    postInvoiceSql = `INSERT INTO invoices (reservation_id, total, surcharges, invoice_date_time, paid) VALUES (?, ?, ?, ?, ?)`;
    db.run(postInvoiceSql, [reservationId, invoice.total, invoice.surcharges, invoice.invoiceDate, invoice.paid], (err, rows) => {
      if (err) {
        console.log(err);
        res.status(500).json({ error: 'Failed to save invoice details'});
        return
      }
      res.status(200).json({
        reservationId: req.query.reservationId,
        invoice: req.body.invoice
      });
    });
  });
  // TODO read req.query.reservationId and req.body.invoice and insert into DB
});

router.post('/reviews', function(req, res) {
  // TODO read req.body.review
  res.status(200).json(req.body);
});

module.exports = router;
