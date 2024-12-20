import React, { useState } from "react";
import {
    useDataGrid,
    EditButton,
    ShowButton,
    DeleteButton,
    List,
    DateField,
    TagField,
} from "@refinedev/mui";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { IconButton, Tooltip, TextField, Box } from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

export const InvoiceList = () => {
    // State for the search term
    const [searchText, setSearchText] = useState("");

    const {
        dataGridProps,
        setFilters, // allows us to set filters dynamically
    } = useDataGrid({
        resource: "invoice",
        initialPageSize: 50,
        syncWithLocation: true,
    });

    const columns = React.useMemo<GridColDef[]>(() => [
        {
            field: "invoice_id",
            flex: 1,
            headerName: "Invoice",
            minWidth: 100,
        },
        {
            field: "supplier_name",
            flex: 1,
            headerName: "Supplier Name",
            minWidth: 200,
        },
        {
            field: "receiver_name",
            flex: 1,
            headerName: "Receiver Name",
            minWidth: 200,
        },
        {
            field: "total_amount",
            flex: 1,
            headerName: "Total Amount",
            minWidth: 100,
            renderCell: ({ value }) => {
                if (typeof value === 'number') {
                    return new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                    }).format(value);
                }
                return value;
            },
        },
        {
            field: "net_amount",
            flex: 1,
            headerName: "Net Amount",
            minWidth: 100,
            renderCell: ({ value }) => {
                if (typeof value === 'number') {
                    return new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                    }).format(value);
                }
                return value;
            },
        },
        {
            field: "total_tax_amount",
            flex: 1,
            headerName: "Total Tax Amount",
            minWidth: 100,
            renderCell: ({ value }) => {
                if (typeof value === 'number') {
                    return new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                    }).format(value);
                }
                return value;
            },
        },        
        {
            field: "labels",
            flex: 1,
            headerName: "Labels",
            minWidth: 200,
            renderCell: ({ row }) => (
                <>
                    {row?.labels?.map((item: any) => (
                        <TagField value={item} key={item} />
                    ))}
                </>
            ),
        },
        {
            field: "receiver_address",
            flex: 1,
            headerName: "Receiver Address",
            minWidth: 200,
        },
        {
            field: "url",
            headerName: "URL",
            minWidth: 100,
            sortable: false,
            renderCell: (params) => {
                const url = params.value;
                return url ? (
                    <Tooltip title="Open Link">
                        <IconButton
                            component="a"
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            color="primary"
                        >
                            <OpenInNewIcon />
                        </IconButton>
                    </Tooltip>
                ) : null;
            },
            align: "center",
            headerAlign: "center",
        },
        {
            field: "invoice_date",
            flex: 1,
            headerName: "Invoice Date",
            minWidth: 100,
            renderCell: ({ value }) => <DateField value={value} />,
        },
        {
            field: "delivery_date",
            flex: 1,
            headerName: "Delivery Date",
            minWidth: 100,
            renderCell: ({ value }) => <DateField value={value} />,
        },
        {
            field: "actions",
            headerName: "Actions",
            sortable: false,
            renderCell: ({ row }) => (
                <>
                    <EditButton hideText recordItemId={row.id} />
                    <ShowButton hideText recordItemId={row.id} />
                    <DeleteButton hideText recordItemId={row.id} />
                </>
            ),
            align: "center",
            headerAlign: "center",
            minWidth: 80,
        },
    ], []);

    // Handler for search input
    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value.trim();
        setSearchText(value);
    
        if (value) {
            // If value is not empty, set the filter
            setFilters([{
                field: "supplier_name",
                operator: "contains",
                value: value,
            }]);
        } else {
            // If value is empty, clear filters
            setFilters([]);
        }
    };
    

    return (
        <List
            // Add a header tool section for the search
            headerButtons={
                <Box sx={{ display: "flex", gap: 2 }}>
                    <TextField
                        variant="outlined"
                        size="small"
                        placeholder="Search by Supplier Name"
                        value={searchText}
                        onChange={handleSearchChange}
                    />
                </Box>
            }
        >
            <DataGrid
                {...dataGridProps}
                columns={columns}
                autoHeight
                pagination
                paginationMode="server"
                rowCount={dataGridProps.rowCount}
                paginationModel={dataGridProps.paginationModel}
                onPaginationModelChange={dataGridProps.onPaginationModelChange}
                pageSizeOptions={[10, 20, 50, 100]}
            />
        </List>
    );
};
