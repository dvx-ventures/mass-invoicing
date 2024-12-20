import React from "react";
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
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { IconButton, Tooltip } from "@mui/material";

export const InvoiceList = () => {
    const {
        dataGridProps,
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
            renderCell: ({ value }) => {
                // Simply return the invoice_id value
                return value;
            },
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
        },
        {
            field: "net_amount",
            flex: 1,
            headerName: "Net Amount",
            minWidth: 100,
        },
        {
            field: "total_tax_amount",
            flex: 1,
            headerName: "Total Tax Amount",
            type: "number",
            minWidth: 100,
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

    return (
        <List>
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
