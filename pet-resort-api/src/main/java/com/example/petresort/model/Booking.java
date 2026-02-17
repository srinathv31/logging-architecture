package com.example.petresort.model;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public class Booking {

    private String bookingId;
    private String petId;
    private String ownerId;
    private BookingStatus status;
    private LocalDate checkInDate;
    private LocalDate checkOutDate;
    private String kennelNumber;
    private BigDecimal totalAmount;
    private Instant createdAt;
    private Instant checkedInAt;
    private Instant checkedOutAt;

    public Booking() {
    }

    public Booking(String bookingId, String petId, String ownerId,
                   LocalDate checkInDate, LocalDate checkOutDate) {
        this.bookingId = bookingId;
        this.petId = petId;
        this.ownerId = ownerId;
        this.status = BookingStatus.PENDING;
        this.checkInDate = checkInDate;
        this.checkOutDate = checkOutDate;
        this.createdAt = Instant.now();
    }

    public String getBookingId() { return bookingId; }
    public void setBookingId(String bookingId) { this.bookingId = bookingId; }

    public String getPetId() { return petId; }
    public void setPetId(String petId) { this.petId = petId; }

    public String getOwnerId() { return ownerId; }
    public void setOwnerId(String ownerId) { this.ownerId = ownerId; }

    public BookingStatus getStatus() { return status; }
    public void setStatus(BookingStatus status) { this.status = status; }

    public LocalDate getCheckInDate() { return checkInDate; }
    public void setCheckInDate(LocalDate checkInDate) { this.checkInDate = checkInDate; }

    public LocalDate getCheckOutDate() { return checkOutDate; }
    public void setCheckOutDate(LocalDate checkOutDate) { this.checkOutDate = checkOutDate; }

    public String getKennelNumber() { return kennelNumber; }
    public void setKennelNumber(String kennelNumber) { this.kennelNumber = kennelNumber; }

    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getCheckedInAt() { return checkedInAt; }
    public void setCheckedInAt(Instant checkedInAt) { this.checkedInAt = checkedInAt; }

    public Instant getCheckedOutAt() { return checkedOutAt; }
    public void setCheckedOutAt(Instant checkedOutAt) { this.checkedOutAt = checkedOutAt; }
}
